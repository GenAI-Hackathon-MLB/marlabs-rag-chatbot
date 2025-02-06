// import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
// import { NonRetryableError } from 'cloudflare:workflows';
// import { Env } from '../../worker-configuration';


// export type DeleteVectorsParams = {
//   Ids: string[];
// };

// export class DeleteVectorsWorkflow extends WorkflowEntrypoint<Env, DeleteVectorsParams> {
//   async run(event: WorkflowEvent<DeleteVectorsParams>, step: WorkflowStep) {

//     await step.do('delete-entries-in-d1-and-vectorize', async () => {
//       const { Ids } = event.payload
//       console.log('ids:', Ids);
      
//       Ids.forEach(async (id) => {
//         try {        //D1
//           console.log("Delete from D1:", id);
//           const delResultD1 = await this.env.DB
//             .prepare('DELETE FROM joblistings WHERE id = ?')
//             .bind(id)
//             .run();
//           console.log("Deleted:", delResultD1.results);

//           // Vectorize
//           console.log("Delete from Vectorize:", id);
//           const delResultVec = await this.env.VECTORIZE.deleteByIds([id])
//           console.log("Deleted:", delResultVec.ids);
//         } catch (error) {
//           console.log("Error Deleting entries: ", String(error));
//           return "error"
//         }
//         return "success"
//       })
//     })
//   }
// };