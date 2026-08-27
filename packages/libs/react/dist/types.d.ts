/**
 * @1consent/react — Typed service/category names (1CO-150 / 1CO-151)
 *
 * These empty interfaces are augmented by the typegen CLI's generated module
 * (`1c typegen`), turning `service`/`category` props into unions of the app's
 * actual configured names. Without generated types they stay empty and the
 * props fall back to `string`.
 *
 * Generated augmentation example:
 * ```ts
 * declare module "@1consent/react" {
 *     interface OneConsentServiceMap {
 *         "Google Analytics": true;
 *     }
 * }
 * ```
 */
export interface OneConsentServiceMap {
}
export interface OneConsentCategoryMap {
}
/** Service name union when typegen ran; otherwise `string`. */
export type RegisteredServiceName = keyof OneConsentServiceMap extends never ? string : keyof OneConsentServiceMap;
/** Category name union when typegen ran; otherwise `string`. */
export type RegisteredCategoryName = keyof OneConsentCategoryMap extends never ? string : keyof OneConsentCategoryMap;
