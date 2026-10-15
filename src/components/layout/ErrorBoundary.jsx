import { Component } from "react";
import { ErrorState } from "../ui";

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("UI crash:", error, info); }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (this.state.error) {
      return <ErrorState message="This screen hit an unexpected problem. Your data is safe – try again, or go back to the dashboard." onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
