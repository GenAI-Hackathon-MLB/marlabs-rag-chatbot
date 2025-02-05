
import { Env } from "../../worker-configuration";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import Groq from 'groq-sdk';

import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { HtmlToTextTransformer } from "@langchain/community/document_transformers/html_to_text";

const axios = require('axios'); // To fetch HTML
const cheerio = require('cheerio'); // For parsing HTML

interface Job {
  role: string;
  link: string;
}

async function getJobChunks(jobUrl: string, env:Env) {
  const loader = new CheerioWebBaseLoader(jobUrl, {
    selector: ".jobDisplay",
  }
  );
  // const transformer = new MozillaReadabilityTransformer();
  const transformer = new HtmlToTextTransformer();
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const docs = await loader.load();
  let transformedDocs = await transformer.invoke(docs);
  console.log("TD",transformedDocs);

    const client = new Groq({
      apiKey: env.GROQ_API_KEY, // This is the default and can be omitted
    });

    const responseChat = await client.chat.completions.create({
      messages: [{role:'system', content: `Summarize the following text into a concise version without adding any introductory or explanatory text. Input text string: ${transformedDocs[0].pageContent}`}],
      temperature: 0.2,
      model: env.LLM_MODEL,
      max_tokens: 700
    });

  console.log("TS:", responseChat.choices[0].message.content);

  transformedDocs[0].pageContent = responseChat.choices[0].message.content || ""
  
  const jobDocuments = await splitter.invoke(transformedDocs);
  // const jobDocuments = await sequence.invoke(docs);
  jobDocuments.map((doc) => {
    doc.pageContent = doc.pageContent
    doc.metadata.loc = JSON.stringify(doc.metadata.loc)
    doc.id = performance.now().toString()
  })
  // console.log('sequence:', jobDocuments, new Date());
  console.log('sequence:', jobDocuments.length, new Date());
  return jobDocuments;
}

async function getAllJobLinks() {
  let jobItems: Job[] = [];
  try {
    // Fetch the HTML from the URL
    let jobIndex:number = 0
    while(true){
      const response = await axios.get(`https://career.marlabs.com/tile-search-results/?q=&sortColumn=referencedate&sortDirection=desc&startrow=${jobIndex}`);
      const html = response.data; // Get the HTML content

      // Load HTML into Cheerio
      const $ = cheerio.load(html);
  
      // Extract text and links from list items
      if($('li.job-tile a').length<=0){
        break
      }
      $('li.job-tile a').each((index: number, element: any) => {
        const role = $(element).text().trim(); // Extract text
        const link = 'https://career.marlabs.com'+$(element).attr('href'); // Extract href

        jobItems.push({ role, link });
      });
      // Remove duplicates based on `jobLink`
      jobItems = Array.from(
        new Map(jobItems.map(job => [job.link, job])).values()
      );
      jobIndex += 25
    }


    console.log('length', jobItems.length);

  } catch (error) {
    if (error instanceof Error) {
      console.error('Error fetching the URL:', error.message);
    } else {
      console.error('Error fetching the URL:', String(error));
    }
  }
  return jobItems;
}
// getAllJobLinks()
// updateJob("https://career.marlabs.com/job/Any-Marlabs-Office-Location-MuleSoft-Developer-1/1248234600/")

export { getAllJobLinks, getJobChunks };