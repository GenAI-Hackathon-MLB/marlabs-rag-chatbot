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

import {HfInference} from '@huggingface/inference'

import { Env } from '../../worker-configuration'
import { DocumentInterface } from '@langchain/core/documents'

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

// Embedding for Vector 
async function getEmbeddings(env: Env) {
  const embeddings = new CloudflareWorkersAIEmbeddings({
    binding: env.CF_AI,
    model: env.CF_EMBEDDING_MODEL,
  })
  return embeddings;
}

// Initialize vector store instance
async function getVectorStore(env: Env) {
  const embeddings = await getEmbeddings(env);
  // Vector store
  const store = new CloudflareVectorizeStore(embeddings, {
    index: env.VECTORIZE,
  })
  return store
}

// vector db similarity search with question
async function queryVectorDB(env: Env, query: string, topKwrgs: number = 5) {
  const store = await getVectorStore(env)

  const results = await store.similaritySearchWithScore(query, topKwrgs)

  return results
}

// This function is used to query the vector store with a user question
async function getVectorContext(env: Env, query: string, topKwrgs: number = 1) {
  
  // Get results from vector DB
  const results = await queryVectorDB(env, query, topKwrgs)

  // Attach context to system message
  // Filter results with similarity score
  const retrievedContext =
    results
      .filter(([document, score]) => score > 0.7)
      .map(([document, score]) => {
        const content = document.pageContent.replaceAll(/[{}]/g, '') || ''
        // Iterate over each key-value pair
        const metadata = document.metadata
        // If these metadata exist remove as they are not relevent
        if (metadata.hasOwnProperty('sql_id')) delete metadata.sql_id
        if (metadata.hasOwnProperty('loc')) delete metadata.loc

        // Convert metadata object to string
        let metadataText = ''
        for (const key in metadata) {
          if (metadata.hasOwnProperty(key)) {
            metadataText += (`${key}: ${metadata[key]}` + ' | ').replaceAll(
              /[{}]/g,
              ''
            )
          }
        }

        // Combine content and metadata
        return `Page Content: ${content} \nMetadata: ${metadataText}`
      })
      .join('\n\n') || ''

  return retrievedContext
}

// PAGE TEXT SUMMARIZATION with AI
async function summarizePageText(env: Env, pageContent: string) {
  // INITIALIZE LLM client
  const client = new Groq({
    apiKey: env.GROQ_API_KEY, // This is the default and can be omitted
  })

  // get text
  const responseChat = await client.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `Clean following text in to text format, remove only new line character and tab caharacter. Input text string: ${pageContent}
        `
      },
    ],
    temperature: 0.2,
    model: env.GROQ_SUMMARIZATION_MODEL,
    max_tokens: 2000,
  })

  return responseChat.choices[0].message.content || pageContent
}

// GET ALL CAREER/JOB POSTING from career page
async function getAllJobLinks() {
  let jobItems: Job[] = []
  let errorM: string = ""
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
      errorM = error.message
      return {jobItems, errorM}
    } else {
      console.error('Error fetching the URL:', String(error))
      errorM = String(error)
      return {jobItems, errorM}
    }
  }
  return {jobItems, errorM}
}

// JOBS get list of jobs to add and delete
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
  console.log('Jobs to Add:', entriesToAdd.length)
  return { entriesToAdd, entriesToDelete }
}

// JOB POSTING get content and convert to chunks
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

async function getChunksFromContent(content: string, url: string, title: string, env: Env) {
  
  // split into chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  })

  // Reduce text and clean up with AI
  const summaryText = await summarizePageText(
    env,
    content
  )

  // assign new content to Docs
  content = summaryText || content

  const docs = [{
      pageContent: content,
      metadata: {
        title,
        source: url,
        loc: "na"
      },
      id: ""
    }
  ] 

  // Get title
  const contentTitle = docs[0].metadata.title || "not found"
  
  // split into chunks
  const contentDocuments = await splitter.invoke(docs)

  // convert metadata.loc object to string
  contentDocuments.map((doc) => {
    doc.pageContent = doc.pageContent
    doc.metadata.loc = JSON.stringify(doc.metadata.loc)
    doc.id = performance.now().toString()
  })
  return contentDocuments;
}

// NORMAL PAGES get content and convert to chunks
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

  // Clean page html
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

  // Transform: extract text from html
  let transformedDocs = await transformer.transformDocuments([{
    pageContent: html || "",
    metadata: docs[0].metadata
  }])

  // Reduce text and clean up with AI
  const summaryText = await summarizePageText(
    env,
    transformedDocs[0].pageContent
  )

  // assign new content to Docs
  transformedDocs[0].pageContent = summaryText || transformedDocs[0].pageContent

  // Get title
  const pageTitle = transformedDocs[0].metadata.title || "not found"
  
  // split into chunks
  const pageDocuments = await splitter.invoke(transformedDocs)

  // convert metadata.loc object to string
  pageDocuments.map((doc) => {
    doc.pageContent = doc.pageContent
    doc.metadata.loc = JSON.stringify(doc.metadata.loc)
    doc.id = performance.now().toString()
  })
  // console.log('sequence:', pageDocuments, new Date());
  // console.log('sequence:', pageDocuments.length, new Date());
  return {pageChunks:pageDocuments, pageContent: summaryText, pageTitle}
}

// HF - Prompt Injection Detection
async function promptDetection(inputText: string, env: Env) {
  const hf = new HfInference(env.HF_ACCESS_TOKEN)
  const result = await hf.textClassification({
    model: "meta-llama/Prompt-Guard-86M",
    inputs: inputText,
  })

  const resultMap = result.reduce((acc, item) => {
    acc[item.label] = item.score;
    return acc;
  }, {} as Record<string, number>);
  console.log("Prompt Injection Detection Result:", "Jailbreak:", resultMap.JAILBREAK, "Injection:", resultMap.INJECTION);
  if (resultMap.INJECTION >= 0.95 || resultMap.JAILBREAK >= 0.95){
    return true
  }
  return false
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
  getChunksFromContent,
  getPageTextChunks,
  promptDetection
};