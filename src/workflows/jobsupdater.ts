import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';
import { Env } from '../../worker-configuration';

const axios = require('axios'); // To fetch HTML
const cheerio = require('cheerio'); // For parsing HTML

export type JobsUpdaterParams = {};
interface Job {
	role: string;
	link: string;
}
export class JobsUpdaterWorkflow extends WorkflowEntrypoint<Env, JobsUpdaterParams> {
	async run(event: WorkflowEvent<JobsUpdaterParams>, step: WorkflowStep) {
		const allCurrentJobList = await step.do('scrape-all-job-listings', async () => {
			let jobItems: Job[] = [];
			// Fetch the HTML from the URL
			let jobIndex: number = 0
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

		const addNewsandRemoveOldJobs = await step.do('add-new-jobs-and-remove-old-jobs', async () => {
			// for (const { role, link } of allCurrentJobList) {
			// 	console.log(role, link);
			// 	const currentTimestamp = Math.floor(Date.now() / 1000);
			// 	const resdb = this.env.DB.prepare(`INSERT INTO joblistings (job_link, job_title, created_at) VALUES ('${link}', '${role}', ${currentTimestamp});`).run();
			// 	break
			// }
			const { results } = await this.env.DB.prepare("SELECT * FROM joblistings").all();
			// const scrapeListValues = allCurrentJobList.role.values;
			// const dbListValues = new Set(Object.values(results));
			// console.log(scrapeListValues);
			// console.log(dbListValues);
			
			

			// const uniqueToObj1 = [...set1].filter(val => !set2.has(val));
			// const uniqueToObj2 = [...set2].filter(val => !set1.has(val));
			// console.log(results);
			return "done"
		});
	}
};