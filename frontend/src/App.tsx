import { useState } from "react";

import { BrainstormCanvas } from "./components/BrainstormCanvas";
import { EntryScreen } from "./components/EntryScreen";
import { useGestureController } from "./hooks/useGestureController";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { fetchBrainstorm } from "./lib/api";
import type { BrainstormResponse, Direction, SelectedNode, TopicNodeData } from "./lib/types";

export default function App() {
  const [topicInput, setTopicInput] = useState("");
  const [graph, setGraph] = useState<BrainstormResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<SelectedNode>("center");
  const [openTopic, setOpenTopic] = useState<TopicNodeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openTopicByKey = (topic: SelectedNode) => {
    if (!graph) {
      return;
    }

    setSelectedNode(topic);
    setOpenTopic(topic === "center" ? graph.root : graph.directions[topic]);
  };

  const selectCenter = () => {
    setSelectedNode("center");
    setOpenTopic(null);
  };

  const highlightDirection = (direction: Direction) => {
    setSelectedNode(direction);
    setOpenTopic(null);
  };

  const openCenter = () => {
    openTopicByKey("center");
  };

  const openDirection = (direction: Direction) => {
    openTopicByKey(direction);
  };

  const openSelected = () => {
    openTopicByKey(selectedNode);
  };

  const handleStartOver = () => {
    setGraph(null);
    setSelectedNode("center");
    setOpenTopic(null);
    setError(null);
  };

  const handlePalmStepBack = () => {
    if (openTopic) {
      setOpenTopic(null);
      return;
    }

    handleStartOver();
  };

  const { videoRef, topicPositions } = useGestureController({
    enabled: Boolean(graph),
    onTopicSelect: openTopicByKey,
    onClosedPalm: handlePalmStepBack,
  });

  useKeyboardNavigation({
    enabled: Boolean(graph),
    selectedNode,
    onSelectCenter: selectCenter,
    onHighlightDirection: highlightDirection,
    onOpenSelected: openSelected,
    onClosePanel: () => setOpenTopic(null),
  });

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextGraph = await fetchBrainstorm(topicInput);
      setGraph(nextGraph);
      setSelectedNode("center");
      setOpenTopic(null);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to start brainstorming right now.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!graph) {
    return (
      <EntryScreen
        value={topicInput}
        isLoading={isLoading}
        error={error}
        onChange={setTopicInput}
        onSubmit={handleSubmit}
      />
    );
  }

  return (
    <BrainstormCanvas
      graph={graph}
      selectedNode={selectedNode}
      openTopic={openTopic}
      videoRef={videoRef}
      topicPositions={topicPositions}
      onBack={handleStartOver}
      onOpenCenter={openCenter}
      onOpenDirection={openDirection}
      onClosePanel={() => setOpenTopic(null)}
    />
  );
}
