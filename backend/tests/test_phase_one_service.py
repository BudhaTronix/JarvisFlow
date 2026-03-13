import unittest

from app.services.phase_one import PhaseOneTopicExpansionService


class PhaseOneTopicExpansionServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = PhaseOneTopicExpansionService()

    def test_blank_topic_returns_static_biology_dataset(self) -> None:
        response = self.service.expand("   ")

        self.assertEqual(response.source, "static")
        self.assertEqual(response.root.label, "Biology")
        self.assertEqual(response.root.content, "Study of living organisms")
        self.assertEqual(response.directions.up.label, "Cells")
        self.assertEqual(response.directions.right.label, "Genetics")
        self.assertEqual(response.directions.down.label, "Ecology")
        self.assertEqual(response.directions.left.label, "Human Body")
        self.assertEqual(len(response.pages), 5)
        self.assertEqual(response.pages[1].title, "Systems")
        self.assertEqual(response.pages[2].root.label, "Evolution")
        self.assertEqual(response.pages[3].title, "Human Systems")
        self.assertEqual(response.pages[4].directions.right.label, "Experimentation")

    def test_non_blank_topic_returns_placeholder_cross(self) -> None:
        response = self.service.expand("Neural Interfaces")

        self.assertEqual(response.source, "placeholder")
        self.assertEqual(response.root.label, "Neural Interfaces")
        self.assertEqual(response.directions.up.label, "Core Idea")
        self.assertEqual(response.directions.right.label, "Applications")
        self.assertEqual(response.directions.down.label, "Questions")
        self.assertEqual(response.directions.left.label, "Related Topics")
        self.assertIn("Neural Interfaces", response.directions.right.content)
        self.assertEqual(len(response.pages), 5)
        self.assertEqual(response.pages[1].title, "Execution")
        self.assertEqual(response.pages[2].directions.down.label, "Risks")
        self.assertEqual(response.pages[3].title, "Signals")
        self.assertEqual(response.pages[4].directions.up.label, "Milestones")


if __name__ == "__main__":
    unittest.main()
