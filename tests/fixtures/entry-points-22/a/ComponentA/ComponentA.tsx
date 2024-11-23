import React from 'react'
export { a } from '../Models/model'

interface ComponentAProps {
  test: string
}

export function ComponentA(props: ComponentAProps): React.JSX.Element {
  const { test } = props
  return <>ComponentA: {test}</>
}
