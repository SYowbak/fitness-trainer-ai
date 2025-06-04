export function removeUndefined<T extends object>(obj: T): Partial<T> {
  const newObj: Partial<T> = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
      newObj[key] = obj[key];
    }
  }
  return newObj;
} 