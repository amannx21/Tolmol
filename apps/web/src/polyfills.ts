// Fill-ins for older phones, loaded before any other module (first import in main.tsx). The Arkiv SDK and viem call
// Object.hasOwn while creating clients and reading attributes; it arrived only in iOS 15.4 and Chrome 93, so without
// this an older phone opens the app but cannot read anything from Arkiv.
if (typeof Object.hasOwn !== "function") {
  Object.defineProperty(Object, "hasOwn", {
    value: (o: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(Object(o), key),
    configurable: true,
    writable: true,
  })
}
