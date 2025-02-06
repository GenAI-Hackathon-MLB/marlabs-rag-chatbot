import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';
import { Env } from '../../worker-configuration';
import { DocumentInterface } from '@langchain/core/documents';

import Groq from 'groq-sdk';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { HtmlToTextTransformer } from "@langchain/community/document_transformers/html_to_text";

import { getJobChunks } from '../utils/career';

const axios = require('axios'); // To fetch HTML
const cheerio = require('cheerio'); // For parsing HTML

export type JobsUpdaterParams = {};

interface Job {
	role: string;
	link: string;
}
interface DbEntry {
	id: string;
	role: string
	link: string;
	created_at: number;
}

export class JobsUpdaterWorkflow extends WorkflowEntrypoint<Env, JobsUpdaterParams> {
	async run(event: WorkflowEvent<JobsUpdaterParams>, step: WorkflowStep) {

		const allCurrentJobList = await step.do('scrape-all-job-listings', async () => {
			let jobItems: Job[] = [
				{
					role: 'Infor M3 Sales Consultant',
					link: 'https://career.marlabs.com/job/Piscataway-Infor-M3-Sales-Consultant-NJ/1207147400/'
				},
				{
					role: 'SAP Basis Consultant',
					link: 'https://career.marlabs.com/job/Any-Marlabs-Office-Location-SAP-Basis-Consultant/1227000700/'
				},
				{
					role: 'Senior Power BI Developer',
					link: 'https://career.marlabs.com/job/Any-Marlabs-Office-Location-Senior-Power-BI-Developer/1217064100/'
				},];
			// Fetch the HTML from the URL
			let jobIndex: number = 0
			return jobItems; //Delete in prod
			while (true) {
				const response = await axios.get(`https://career.marlabs.com/tile-search-results/?q=&sortColumn=referencedate&sortDirection=desc&startrow=${jobIndex}`);
				const html = response.data; // Get the HTML content

				// Load HTML into Cheerio
				const $ = cheerio.load(html);
				// If nothing in the li tags, break loop
				if ($('li.job-tile a').length <= 0) {
					break
				}
				// Extract text and links from list items
				$('li.job-tile a').each((index: number, element: any) => {
					const role = $(element).text().trim(); // Extract text
					const link = 'https://career.marlabs.com' + $(element).attr('href'); // Extract href
					jobItems.push({ role, link });
				});
				// Remove duplicates based on `jobLink`
				jobItems = Array.from(
					new Map(jobItems.map(job => [job.link, job])).values()
				);
				jobIndex += 25
			}
			return jobItems;
		});

		// Get updated Job Listing
		const getExpiredAndNewJobs = await step.do('get-expired-and-new-jobs', async () => {

			const { results } = await this.env.DB.prepare("SELECT * FROM joblistings").all<DbEntry>();
			const entriesToAdd: Job[] = [];
			const entriesToDelete: string[] = [];
			const newEntriesMap = new Map();

			// Create a map of new entries using link as the key
			allCurrentJobList.forEach(entry => {
				newEntriesMap.set(entry.link, entry);
			});

			// Check each entry in the database list
			results.forEach(dbEntry => {
				const newEntry = newEntriesMap.get(dbEntry.link);
				if (!newEntry) {
					// Entry not in new list: delete
					entriesToDelete.push(dbEntry.id);
				} else {
					// Remove matched entry to track remaining new entries
					newEntriesMap.delete(dbEntry.link);
				}
			});
			// After processing all dbEntries, the remaining newEntriesMap contains entries to add
			const remainingNewEntries = Array.from(newEntriesMap.values());
			entriesToAdd.push(...remainingNewEntries);

			console.log("Jobs to Delete:", entriesToDelete.length);
			console.log("Jobs to Add", entriesToAdd.length);

			return { entriesToAdd, entriesToDelete }
		});

		// Delete listing
		// await step.do('send-for-delete', async () => {
		// 	//Send ids for deletion from D1 and Vector
		// 	const { entriesToDelete } = getExpiredAndNewJobs
		// 	const res = await this.env.DELETEVECTORS_WORKFLOW.create({ params: { Ids: entriesToDelete } })
		// 	console.log("Delete Workflow:", res.id);
		// 	return res.id
		// });

		await step.sleep('wait-for-publish', '2 seconds');
		// Add listing
		await step.do('send-for-adding-to-kb', async () => {
			//get job description and send for adding to KB
			const { entriesToAdd } = getExpiredAndNewJobs

			let jobChunksList: DocumentInterface[] = []
			for (const { role, link } of entriesToAdd) {
				console.log("Job: ", role + ", " + link);
				const chunk = await getJobChunks(link,this.env)
				console.log(chunk.length);
			}
			
			// for (const { role, link } of entriesToAdd) {
			// 	console.log("Job: ", role + ", " + link);

			// 	const loader = new CheerioWebBaseLoader(link, {
			// 		selector: ".jobDisplay",
			// 	});

			// 	// const transformer = new MozillaReadabilityTransformer();
			// 	const transformer = new HtmlToTextTransformer();
			// 	const splitter = new RecursiveCharacterTextSplitter({
			// 		chunkSize: 1000,
			// 		chunkOverlap: 200,
			// 	});

			// 	console.log("testlog");
			// 	const docs = await loader.load();
			// 	let transformedDocs = await transformer.invoke(docs);
				
			// 	const client = new Groq({
			// 		apiKey: this.env.GROQ_API_KEY, // This is the default and can be omitted
			// 	});

			// 	const responseSummary = await client.chat.completions.create({
			// 		messages: [{ role: 'system', content: `Summarize the following text into a concise version without adding any introductory or explanatory text. Input text string: ${transformedDocs[0].pageContent}` }],
			// 		temperature: 0.2,
			// 		model: this.env.SUMMARIZATION_MODEL,
			// 		max_tokens: 700
			// 	});

			// 	// console.log("TS:", responseSummary.choices[0].message.content);

			// 	transformedDocs[0].pageContent = responseSummary.choices[0].message.content || ""

			// 	const jobDocuments = await splitter.invoke(transformedDocs);
			// 	// const jobDocuments = await sequence.invoke(docs);
			// 	jobDocuments.map((doc) => {
			// 		doc.pageContent = doc.pageContent
			// 		doc.metadata.loc = JSON.stringify(doc.metadata.loc)
			// 		doc.id = performance.now().toString()
			// 	})
				
			// 	jobChunksList.push(...jobDocuments)
			// 	// const addRes= await this.env.ADDVECTORS_WORKFLOW.create({params:{docs: jobDocuments}})
			// 	// console.log(addRes);
			// }
			// console.log("Docs:", jobChunksList.length);

			return "done"
		});
	}
};