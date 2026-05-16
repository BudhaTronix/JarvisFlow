import { useState } from "react";

import { BrainstormCanvas } from "./components/BrainstormCanvas";
import { EntryScreen } from "./components/EntryScreen";
import { useGestureController } from "./hooks/useGestureController";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { fetchBrainstorm } from "./lib/api";
import type { BrainstormPageData, BrainstormResponse, Direction, SelectedNode, TopicNodeData } from "./lib/types";

function getPages(graph: BrainstormResponse): BrainstormPageData[] {
  if (graph.pages.length > 0) {
    return graph.pages;
  }

  return [
    {
      id: "default-page",
      title: "Overview",
      root: graph.root,
      directions: graph.directions,
    },
  ];
}

export default function App() {
  const [topicInput, setTopicInput] = useState("");
  const [graph, setGraph] = useState<BrainstormResponse | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedNode, setSelectedNode] = useState<SelectedNode>("center");
  const [openTopic, setOpenTopic] = useState<TopicNodeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pages = graph ? getPages(graph) : [];
  const activePage = graph ? pages[Math.min(pageIndex, Math.max(pages.length - 1, 0))] : null;
  const canMoveToPreviousPage = pageIndex > 0;
  const canMoveToNextPage = pageIndex < pages.length - 1;

  const closeOpenTopic = () => {
    setOpenTopic(null);
  };

  const goToPage = (nextIndex: number) => {
    if (!graph) {
      return;
    }

    const clampedIndex = Math.max(0, Math.min(nextIndex, pages.length - 1));
    if (clampedIndex === pageIndex) {
      return;
    }

    setPageIndex(clampedIndex);
    setSelectedNode("center");
    closeOpenTopic();
  };

  const goToNextPage = () => {
    if (!canMoveToNextPage) {
      return;
    }

    goToPage(pageIndex + 1);
  };

  const goToPreviousPage = () => {
    if (!canMoveToPreviousPage) {
      return;
    }

    goToPage(pageIndex - 1);
  };

  const openTopicByKey = (topic: SelectedNode) => {
    if (!activePage) {
      return;
    }

    setSelectedNode(topic);
    setOpenTopic(topic === "center" ? activePage.root : activePage.directions[topic]);
  };

  const selectCenter = () => {
    setSelectedNode("center");
    closeOpenTopic();
  };

  const highlightDirection = (direction: Direction) => {
    setSelectedNode(direction);
    closeOpenTopic();
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
    setPageIndex(0);
    setSelectedNode("center");
    closeOpenTopic();
    setError(null);
  };

  const handlePalmStepBack = () => {
    if (openTopic) {
      closeOpenTopic();
      return;
    }

    handleStartOver();
  };

  const { videoRef, gpuCanvasRef, topicPositions, triggerTopic } = useGestureController({
    enabled: Boolean(graph),
    isTopicOpen: Boolean(openTopic),
    canMoveToNextPage,
    canMoveToPreviousPage,
    onTopicSelect: openTopicByKey,
    onClosedPalm: handlePalmStepBack,
    onSwipeNextPage: goToNextPage,
    onSwipePreviousPage: goToPreviousPage,
  });

  useKeyboardNavigation({
    enabled: Boolean(graph),
    canMoveToNextPage,
    canMoveToPreviousPage,
    selectedNode,
    onSelectCenter: selectCenter,
    onHighlightDirection: highlightDirection,
    onOpenSelected: openSelected,
    onClosePanel: closeOpenTopic,
    onNextPage: goToNextPage,
    onPreviousPage: goToPreviousPage,
  });

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextGraph = await fetchBrainstorm(topicInput);
      setGraph(nextGraph);
      setPageIndex(0);
      setSelectedNode("center");
      closeOpenTopic();
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

  if (!graph || !activePage) {
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
      page={activePage}
      source={graph.source}
      selectedNode={selectedNode}
      openTopic={openTopic}
      triggerTopic={triggerTopic}
      videoRef={videoRef}
      gpuCanvasRef={gpuCanvasRef}
      topicPositions={topicPositions}
      pageIndex={pageIndex}
      totalPages={pages.length}
      canMoveToNextPage={canMoveToNextPage}
      canMoveToPreviousPage={canMoveToPreviousPage}
      onBack={handleStartOver}
      onNextPage={goToNextPage}
      onPreviousPage={goToPreviousPage}
      onOpenCenter={openCenter}
      onOpenDirection={openDirection}
      onClosePanel={closeOpenTopic}
    />
  );
}
