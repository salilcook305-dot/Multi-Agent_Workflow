import unittest

from app.agents.output_type import detect_output_type


class DetectOutputTypeTests(unittest.TestCase):
    def test_detects_code_generation_goals(self):
        self.assertEqual(detect_output_type("build a REST API"), "code")

    def test_detects_report_goals(self):
        self.assertEqual(detect_output_type("analyze the presentation"), "report")

    def test_report_request_wins_over_a_mentioned_code_subject(self):
        self.assertEqual(detect_output_type("analyze the API architecture"), "report")

    def test_explicit_report_request_wins_over_code_as_subject(self):
        self.assertEqual(detect_output_type("write a report about code quality"), "report")

    def test_unspecified_goal_preserves_code_default(self):
        self.assertEqual(detect_output_type("help me with this"), "code")


if __name__ == "__main__":
    unittest.main()
