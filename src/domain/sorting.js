export function mergeSort(items, compare) {
  if (!Array.isArray(items)) throw new Error('items must be array');
  const arr = [...items]; // never modify original
  if (arr.length <= 1) return [...arr];

  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid), compare);
  const right = mergeSort(arr.slice(mid), compare);

  return merge(left, right, compare);
}

function merge(left, right, compare) {
  const result = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    const cmp = compare(left[i], right[j]);
    // stable: if equal (cmp===0), take left first to keep original order
    if (cmp <= 0) {
      result.push(left[i++]);
    } else {
      result.push(right[j++]);
    }
  }
  while (i < left.length) result.push(left[i++]);
  while (j < right.length) result.push(right[j++]);
  return result;
}
