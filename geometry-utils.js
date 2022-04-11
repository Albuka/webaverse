const geometryUtils = (() => {
  const scope = {};
  const NUM_WORKER = 4;
  scope.workers = [];
  scope.workingFlags = [];
  scope.resolves = [];

  for (let i = 0; i < NUM_WORKER; i++) {
    scope.workers.push(new Worker('./geometry-utils.worker.js', {type: 'module'}));
    scope.workingFlags.push(false);
    scope.resolves.push(() => {});

    scope.workers[i].onmessage = e => {
      if (e.data.message === 'generateTerrain') {
        scope.resolves[e.data.workerIndex]({
          positionCount: e.data.positionCount,
          indexCount: e.data.indexCount,
          arrays: e.data.arrays,
          buffers: e.data.buffers
        });
        scope.workingFlags[e.data.workerIndex] = false;
      // } else if (e.data.message === 'deallocateChunk') {
      //   scope.resolves[i]({
      //     arrays: e.data.arrays
      //   });
      // } else if (e.data.message === 'generateAndAllocateChunk') {
      //   scope.resolves[i]({
      //     arrays: e.data.arrays,
      //     slots: e.data.slots
      //   });
      } else if (e.data.message === 'generateChunk') {
        console.log('>>> done worker: ', e.data.workerIndex);
        scope.resolves[e.data.workerIndex](e.data.output);
        scope.workingFlags[e.data.workerIndex] = false;
      }
    }
  }
  // scope.worker = new Worker('./geometry-utils.worker.js', {type: 'module'});

  scope.generateTerrain = async (
    chunkSize, chunkCount, segment, vertexBufferSizeParam, indexBufferSizeParam, arrays
  ) => {
    return new Promise((resolve, reject) => {
      const idleWorkerIndex = scope.workingFlags.findIndex(e => e === false);
      if (idleWorkerIndex === -1) {
        reject('no idle worker');
      }

      scope.workingFlags[idleWorkerIndex] = true;
      scope.workers[idleWorkerIndex].postMessage({
        workerIndex: idleWorkerIndex,
        message: 'generateTerrain',
        params: [chunkSize, chunkCount, segment, vertexBufferSizeParam, indexBufferSizeParam],
        arrays: arrays
      }, arrays.map(a => a.buffer));

      scope.resolves[idleWorkerIndex] = resolve;
    });
  }

  // scope.deallocateChunk = async (
  //   vertexSlot, indexSlot, totalChunkCount,
  //   chunkVertexRangeBuffer, vertexFreeRangeBuffer, chunkIndexRangeBuffer, indexFreeRangeBuffer,
  //   arrays
  // ) => {
  //   return new Promise((resolve, reject) => {
  //     try {
  //       scope.worker.postMessage({
  //         message: 'deallocateChunk',
  //         params: [
  //           vertexSlot, indexSlot, totalChunkCount, chunkVertexRangeBuffer,
  //           vertexFreeRangeBuffer, chunkIndexRangeBuffer, indexFreeRangeBuffer
  //         ],
  //         arrays: arrays
  //       }, arrays.map(a => a.buffer));
  //     } catch (e) {
  //       // debugger
  //     }

  //     scope.resolve = resolve;
  //   });
  // }

  // scope.generateAndAllocateChunk = async (
  //   positionBuffer, normalBuffer, biomeBuffer, indexBuffer,
  //   chunkVertexRangeBuffer, vertexFreeRangeBuffer, chunkIndexRangeBuffer, indexFreeRangeBuffer,
  //   x, y, z, chunkSize, segment, totalChunkCount, arrays
  // ) => {
  //   return new Promise((resolve, reject) => {
  //     scope.worker.postMessage({
  //       message: 'generateAndAllocateChunk',
  //       params: [
  //         positionBuffer, normalBuffer, biomeBuffer, indexBuffer,
  //         chunkVertexRangeBuffer, vertexFreeRangeBuffer, chunkIndexRangeBuffer, indexFreeRangeBuffer,
  //         x, y, z, chunkSize, segment, totalChunkCount,
  //       ],
  //       arrays: arrays
  //     }, arrays.map(a => a.buffer));

  //     scope.resolve = resolve;
  //   });
  // }

  scope.generateChunk = async (x, y, z, chunkSize, segment) => {
    return new Promise((resolve, reject) => {
      const idleWorkerIndex = scope.workingFlags.findIndex(e => e === false);
      if (idleWorkerIndex === -1) {
        reject('no idle worker');
        return;
      }

      console.log('>>> worker index:', idleWorkerIndex);

      scope.workingFlags[idleWorkerIndex] = true;

      scope.workers[idleWorkerIndex].postMessage({
        workerIndex: idleWorkerIndex,
        message: 'generateChunk',
        params: [x, y, z, chunkSize, segment]
      });
      scope.resolves[idleWorkerIndex] = resolve;
    })
  }

  return scope;
})();

export default geometryUtils;
