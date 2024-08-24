import { type Num } from './types'
export type Str = string

export function hello(s: Str): Str {
  return 'hello' + s
}

export let num: Num = 1
