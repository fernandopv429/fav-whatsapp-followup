import FlowEditorClient from "./FlowEditorClient";

export const instant = false;

export default async function FlowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FlowEditorClient flowId={id} />;
}
