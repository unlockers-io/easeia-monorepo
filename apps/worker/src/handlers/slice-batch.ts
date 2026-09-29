type BatchSlice<Value> = {
  next: number;
  slice: ReadonlyArray<Value>;
};

const sliceBatch = <Value>(
  values: ReadonlyArray<Value>,
  cursor: number,
  batchSize = 50,
): BatchSlice<Value> => {
  const slice = values.slice(cursor, cursor + batchSize);
  return { next: cursor + slice.length, slice };
};

export { sliceBatch };
export type { BatchSlice };
