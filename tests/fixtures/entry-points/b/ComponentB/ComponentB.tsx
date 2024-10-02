import React from "react";

interface ComponentBProps {
  test: string;
}

export function ComponentB(props: ComponentBProps): React.JSX.Element {
  const { test } = props;
  return <>ComponentB: {test}</>;
}
