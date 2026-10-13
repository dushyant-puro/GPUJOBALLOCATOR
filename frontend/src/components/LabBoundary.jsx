import { Component } from "react";

export default class LabBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="studio-error" role="alert"><strong>This view could not be displayed.</strong><p>Your simulation remains in the local engine. Retry this view or use the workspace navigation.</p><button type="button" className="studio-button secondary" onClick={() => this.setState({ failed: false })}>Retry view</button></div>;
    return this.props.children;
  }
}
