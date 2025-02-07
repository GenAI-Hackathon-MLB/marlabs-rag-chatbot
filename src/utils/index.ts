import {
  CloudflareVectorizeStore,
  CloudflareWorkersAIEmbeddings,
} from '@langchain/cloudflare'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio'
import { HtmlToTextTransformer } from '@langchain/community/document_transformers/html_to_text'
import Groq from 'groq-sdk'

const axios = require('axios') // To fetch HTML
const cheerio = require('cheerio') // For parsing HTML

import { Env } from '../../worker-configuration'

interface Job {
  role: string
  link: string
}

interface JobDbEntry {
  id: string
  role: string
  url: string
  created_at: number
}

interface KBDbEntry {
  id: string
  url: string
  title: string
  content: string
  type: string
  created_at: number
}

// VECTOR DB
async function getEmbeddings(env: Env) {
  const embeddings = new CloudflareWorkersAIEmbeddings({
    binding: env.CF_AI,
    model: env.CF_EMBEDDING_MODEL,
  })
  return embeddings
}

async function getVectorStore(env: Env) {
  const embeddings = await getEmbeddings(env)
  const store = new CloudflareVectorizeStore(embeddings, {
    index: env.VECTORIZE,
  })
  return store
}

async function queryVectorDB(env: Env, query: string, topKwrgs: number = 3) {
  const store = await getVectorStore(env)

  const results = await store.similaritySearchWithScore(query, topKwrgs)
  // console.log("vector query: ", results);

  return results
}
// This function is used to query the vector store with a query
async function getVectorContext(env: Env, query: string, topKwrgs: number = 1) {
  // Get results from vector DB
  const results = await queryVectorDB(env, query, topKwrgs)

  // Attach context to system message
  const retrievedContext =
    results
      .filter(([document, score]) => score > 0.7)
      .map(([document, score]) => {
        const content = document.pageContent.replaceAll(/[{}]/g, '') || ''
        // Iterate over each key-value pair
        const metadata = document.metadata
        if (metadata.hasOwnProperty('sql_id')) delete metadata.sql_id
        if (metadata.hasOwnProperty('loc')) delete metadata.loc
        let metadataText = ''
        for (const key in metadata) {
          if (metadata.hasOwnProperty(key)) {
            metadataText += (`${key}: ${metadata[key]}` + ' | ').replaceAll(
              /[{}]/g,
              ''
            )
          }
        }
        return `Page Content: ${content} \nMetadata: ${metadataText}`
      })
      .join('\n\n') || ''

  return retrievedContext
}

// TEXT SUMMARIZATION
async function summarizePageText(env: Env, pageContent: string) {
  const client = new Groq({
    apiKey: env.GROQ_API_KEY, // This is the default and can be omitted
  })

  const responseChat = await client.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `Clean following text in to text format, remove only new line character, tab caharacter and white spaces. Input text string: ${pageContent}
        `
      },
    ],
    temperature: 0.2,
    model: env.GROQ_SUMMARIZATION_MODEL,
    max_tokens: 2000,
  })

  return responseChat.choices[0].message.content || pageContent
}

//CAREER/JOB POSTING
async function getAllJobLinks() {
  let jobItems: Job[] = []
  try {
    // Fetch the HTML from the URL
    let jobIndex: number = 0
    while (true) {
      const response = await axios.get(
        `https://career.marlabs.com/tile-search-results/?q=&sortColumn=referencedate&sortDirection=desc&startrow=${jobIndex}`
      )
      const html = response.data // Get the HTML content

      // Load HTML into Cheerio
      const $ = cheerio.load(html)

      // Extract text and links from list items
      if ($('li.job-tile a').length <= 0) {
        break
      }
      $('li.job-tile a').each((index: number, element: any) => {
        const role = $(element).text().trim() // Extract text
        const link = 'https://career.marlabs.com' + $(element).attr('href') // Extract href

        jobItems.push({ role, link })
      })
      // Remove duplicates based on `jobLink`
      jobItems = Array.from(
        new Map(jobItems.map((job) => [job.link, job])).values()
      )
      jobIndex += 25
    }
    // console.log('length', jobItems.length);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error fetching the URL:', error.message)
    } else {
      console.error('Error fetching the URL:', String(error))
    }
  }
  return jobItems
}

async function getCleanJobList(allCurrentJobList: Job[], env: Env) {
  const { results } = await env.D1DB.prepare(
    'SELECT * FROM joblistings'
  ).all<JobDbEntry>()
  const entriesToAdd: Job[] = []
  const entriesToDelete: string[] = []
  const newEntriesMap = new Map()

  // Create a map of new entries using link as the key
  allCurrentJobList.forEach((entry) => {
    newEntriesMap.set(entry.link, entry)
  })

  // Check each entry in the database list
  results.forEach((dbEntry) => {
    const newEntry = newEntriesMap.get(dbEntry.url)
    if (!newEntry) {
      // Entry not in new list: delete
      entriesToDelete.push(dbEntry.id)
    } else {
      // Remove matched entry to track remaining new entries
      newEntriesMap.delete(dbEntry.url)
    }
  })
  // After processing all dbEntries, the remaining newEntriesMap contains entries to add
  const remainingNewEntries = Array.from(newEntriesMap.values())
  entriesToAdd.push(...remainingNewEntries)

  console.log('Jobs to Delete:', entriesToDelete.length)
  console.log('Jobs to Add', entriesToAdd.length)
  return { entriesToAdd, entriesToDelete }
}

async function getJobChunks(jobUrl: string, env: Env) {
  const loader = new CheerioWebBaseLoader(jobUrl, {
    selector: '.jobDisplay',
  })
  // const transformer = new MozillaReadabilityTransformer();
  const transformer = new HtmlToTextTransformer()
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  })

  const docs = await loader.load()
  let transformedDocs = await transformer.invoke(docs)
  // console.log("TD",transformedDocs);

  const summaryText = await summarizePageText(
    env,
    transformedDocs[0].pageContent
  )
  // console.log("TS:", responseChat.choices[0].message.content);

  transformedDocs[0].pageContent = summaryText

  const jobDocuments = await splitter.invoke(transformedDocs)
  // const jobDocuments = await sequence.invoke(docs);
  jobDocuments.map((doc) => {
    doc.pageContent = doc.pageContent
    doc.metadata.loc = JSON.stringify(doc.metadata.loc)
    doc.id = performance.now().toString()
  })
  // console.log('sequence:', jobDocuments, new Date());
  // console.log('sequence:', jobDocuments.length, new Date());
  return jobDocuments
}

// NORMAL PAGES
async function getPageTextChunks(pageUrl: string, env: Env) {
  const loader = new CheerioWebBaseLoader(pageUrl, {
    selector: 'body',
  })
  // const transformer = new MozillaReadabilityTransformer();
  const transformer = new HtmlToTextTransformer()
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  })

  const docs = await loader.load()
  const $ = await loader.scrape()
  $('header').remove()
  $('footer').remove()
  $('script').remove()
  $('style').remove()
  $('svg').remove()
  $('img').remove()
  $('a').remove()
  $('link').remove()
  $('noscript').remove()
  $('div#cookie-notice-consent').remove()
  const html = $('body').html()

  // let transformedDocs = await transformer.invoke(docs)
  let transformedDocs = await transformer.transformDocuments([{
    pageContent: html || "",
    metadata: docs[0].metadata
  }])
  console.log('TD', transformedDocs)

  // throw Error('Test')
  let summaryText = transformedDocs[0].pageContent
  summaryText = await summarizePageText(
    env,
    transformedDocs[0].pageContent
  )
  console.log("Summarized:", summaryText);

  transformedDocs[0].pageContent = summaryText

  const jobDocuments = await splitter.invoke(transformedDocs)
  // const jobDocuments = await sequence.invoke(docs);
  jobDocuments.map((doc) => {
    doc.pageContent = doc.pageContent
    doc.metadata.loc = JSON.stringify(doc.metadata.loc)
    doc.id = performance.now().toString()
  })
  console.log('sequence:', jobDocuments, new Date());
  console.log('sequence:', jobDocuments.length, new Date());
  return jobDocuments
}

export {
  getEmbeddings,
  getVectorStore,
  queryVectorDB,
  getVectorContext,
  summarizePageText,
  getJobChunks,
  getAllJobLinks,
  getCleanJobList,
  getPageTextChunks,
};