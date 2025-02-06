// import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
// import { NonRetryableError } from 'cloudflare:workflows';
// import { Env } from '../../worker-configuration';
// import { DocumentInterface } from '@langchain/core/documents';


// export type AddVectorsParams = {
//   docs:DocumentInterface[]
// };

// export class AddVectorsWorkflow extends WorkflowEntrypoint<Env, AddVectorsParams> {
//   async run(event: WorkflowEvent<AddVectorsParams>, step: WorkflowStep) {
    
//     const batchedDocuments = await step.do('batch-documents', async () => {
//       const {docs} = event.payload
//       console.log("Len",docs.length);
      
//       return "ok"
//     })
//   }
// };