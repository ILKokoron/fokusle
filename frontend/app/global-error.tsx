"use client";

import { Component, ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class GlobalError extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    // eslint-disable-next-line no-console
    console.error("GLOBAL_ERROR:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, background: "#1a1024", color: "#fff", fontFamily: "monospace", minHeight: "100vh" }}>
          <h2 style={{ fontSize: 16 }}>Client error</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "#000", padding: 12, borderRadius: 8, color: "#ff9b9b" }}>
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 12, background: "#6E54FF", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
