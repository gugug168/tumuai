/**
 * 高级TypeScript实用工具类型库
 * 提供企业级类型操作和泛型工具
 */

// === 基础实用工具类型 ===

/** 将所有属性变为可选但非undefined */
export type Optional<T, K extends keyof T = keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/** 将指定属性变为必需 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

/** 深度只读 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

/** 深度可选 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/** 非空数组 */
export type NonEmptyArray<T> = [T, ...T[]]

/** 严格的对象类型（排除null/undefined） */
export type StrictObject<T> = T extends object ? (T extends null ? never : T) : never

// === API响应类型工具 ===

/** 标准化API响应包装器 */
export interface ApiWrapper<TData = unknown, TError = string> {
  data: TData | null
  error: TError | null
  success: boolean
  timestamp: string
}

/** 分页响应类型 */
export interface PaginatedData<T> {
  items: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/** 创建分页响应类型 */
export type PaginatedResponse<T> = ApiWrapper<PaginatedData<T>>

// === 表单和验证类型 ===

/** 表单字段值类型 */
export type FormValue = string | number | boolean | Date | string[] | null | undefined

/** 表单数据类型 */
export type FormData<T = Record<string, FormValue>> = {
  [K in keyof T]: T[K]
}

/** 表单错误类型 */
export type FormErrors<T> = Partial<Record<keyof T, string | string[]>>

/** 表单状态 */
export interface FormState<T> {
  values: FormData<T>
  errors: FormErrors<T>
  touched: Partial<Record<keyof T, boolean>>
  isSubmitting: boolean
  isValid: boolean
}

// === 异步状态管理 ===

/** 异步操作状态 */
export interface AsyncState<TData = unknown, TError = Error> {
  data: TData | null
  loading: boolean
  error: TError | null
  lastFetch: Date | null
}

/** 异步操作结果 */
export type AsyncResult<TData, TError = Error> = 
  | { success: true; data: TData; error: null }
  | { success: false; data: null; error: TError }

/** Mutation状态 */
export interface MutationState<TData = unknown, TError = Error> {
  data: TData | null
  loading: boolean
  error: TError | null
  success: boolean
}

// === 条件类型工具 ===

/** 提取Promise的返回类型 */
export type Awaited<T> = T extends PromiseLike<infer U> ? U : T

/** 提取函数返回类型 */
export type ReturnTypeOf<T> = T extends (...args: any[]) => infer R ? R : never

/** 提取函数参数类型 */
export type Parameters<T> = T extends (...args: infer P) => any ? P : never

/** 键值映射类型 */
export type KeyValue<K extends PropertyKey, V> = Record<K, V>

// === 字符串操作类型 ===

/** 首字母大写 */
export type Capitalize<T extends string> = T extends `${infer F}${infer R}` 
  ? `${Uppercase<F>}${R}` 
  : T

/** 首字母小写 */
export type Uncapitalize<T extends string> = T extends `${infer F}${infer R}` 
  ? `${Lowercase<F>}${R}` 
  : T

/** 驼峰转连字符 */
export type KebabCase<T extends string> = T extends `${infer L}${infer R}`
  ? L extends Uppercase<L>
    ? L extends Lowercase<L>
      ? `${L}${KebabCase<R>}`
      : `-${Lowercase<L>}${KebabCase<R>}`
    : `${L}${KebabCase<R>}`
  : T

// === 数据库/ORM类型工具 ===

/** 数据库实体基类 */
export interface BaseEntity {
  readonly id: string
  readonly created_at: string
  readonly updated_at: string
}

/** 创建输入类型（去除系统字段） */
export type CreateInput<T extends BaseEntity> = Omit<T, 'id' | 'created_at' | 'updated_at'>

/** 更新输入类型（系统字段可选） */
export type UpdateInput<T extends BaseEntity> = Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>

/** 查询过滤器 */
export type QueryFilters<T> = {
  [K in keyof T]?: T[K] | T[K][] | {
    eq?: T[K]
    neq?: T[K]
    in?: T[K][]
    like?: string
    ilike?: string
    gt?: T[K]
    gte?: T[K]
    lt?: T[K]
    lte?: T[K]
  }
}

// === 组件Props类型工具 ===

/** React组件基础Props */
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
  testId?: string
}

/** 转发Ref的组件Props */
export type ForwardRefComponent<T, P = {}> = React.ForwardRefExoticComponent<
  React.PropsWithoutRef<P> & React.RefAttributes<T>
>

/** 提取组件Props类型 */
export type ComponentProps<T> = T extends React.ComponentType<infer P> ? P : never

// === 事件处理类型 ===

/** 标准事件处理器 */
export type EventHandler<T = Event> = (event: T) => void

/** 表单事件处理器 */
export type FormEventHandler<T = HTMLElement> = EventHandler<React.FormEvent<T>>

/** 点击事件处理器 */
export type ClickEventHandler<T = HTMLElement> = EventHandler<React.MouseEvent<T>>

/** 变更事件处理器 */
export type ChangeEventHandler<T = HTMLInputElement> = EventHandler<React.ChangeEvent<T>>

// === 类型守卫工具 ===

/** 检查是否为非空值 */
export function isNotNull<T>(value: T | null): value is T {
  return value !== null
}

/** 检查是否为非undefined值 */
export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

/** 检查是否为非空非undefined值 */
export function isPresent<T>(value: T | null | undefined): value is T {
  return value != null
}

/** 检查是否为字符串 */
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/** 检查是否为数字 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value)
}

/** 检查是否为布尔值 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

/** 检查是否为数组 */
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value)
}

/** 检查是否为非空数组 */
export function isNonEmptyArray<T>(value: T[]): value is NonEmptyArray<T> {
  return value.length > 0
}

/** 检查是否为对象 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// === 实用工具函数 ===

/** 安全的JSON解析 */
export function safeJsonParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

/** 创建类型安全的枚举 */
export function createEnum<T extends Record<string, string>>(obj: T): T {
  return Object.freeze(obj)
}

/** 断言永不到达 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`)
}

// === 高级条件类型示例 ===

/** 根据条件选择类型 */
export type ConditionalType<T, Condition, TrueType, FalseType> = 
  T extends Condition ? TrueType : FalseType

/** 递归获取嵌套对象的所有键 */
export type NestedKeys<T> = {
  [K in keyof T & (string | number)]: T[K] extends object 
    ? `${K}` | `${K}.${NestedKeys<T[K]>}`
    : `${K}`
}[keyof T & (string | number)]

/** 根据嵌套键获取值类型 */
export type NestedValue<T, K extends NestedKeys<T>> = 
  K extends `${infer Key}.${infer Rest}`
    ? Key extends keyof T
      ? Rest extends NestedKeys<T[Key]>
        ? NestedValue<T[Key], Rest>
        : never
      : never
    : K extends keyof T
      ? T[K]
      : never