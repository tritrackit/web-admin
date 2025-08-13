export const convertNotationToObject = (notation: string, nestedValue):any => {
    let object = {}
    let pointer = object;
    notation.split('.').map( (key, index, arr) => {
      pointer = (pointer[key] = (index == arr.length - 1? nestedValue: {}))
    });
    return object;
}


export const getImageExtensionByDataURL = (dataUrl) => {
  return dataUrl.split(';')[0].split('/')[1];
}
