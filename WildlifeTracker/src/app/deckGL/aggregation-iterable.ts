export const eventsAsyncIterable = {
  [Symbol.asyncIterator]() {
    return {
      async next() {
        // NOTE:Run some asynchronous operation here.
        return  { done: true, value: 1 };
      }
    }
  }
}

// NOTE: Usage looks like
// async function* getData(){
// for (const date of getChunk()){
// yield date;
// }
// }
//
// function() {
// return new Layer({
//  data: getData()
// });
// }

// TODO:Design what the actual promise to await would
// look like.
// The iterable itself needs to yield values
// values every times a chunk arrives
// and return when the streamEnds.
