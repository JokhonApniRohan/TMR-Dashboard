import re
from pathlib import Path
from datetime import datetime


class FilenameParser:
    """
    Parses uploaded TMR report filenames.

    Supported formats:
        TMR Daily Activity Report 2026-06-01 to 2026-06-01.xlsx
        TMR Datewise Summary 2026-06-01 to 2026-06-01.xlsx
    """

    ACTIVITY_PATTERN = re.compile(
        r"^TMR Daily Activity Report (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})\.(xlsx|xls)$",
        re.IGNORECASE,
    )

    SUMMARY_PATTERN = re.compile(
        r"^TMR Datewise Summary (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})\.(xlsx|xls)$",
        re.IGNORECASE,
    )

    @staticmethod
    def parse(filename: str) -> dict:
        """
        Returns:
        {
            "valid": True/False,
            "file_type": "activity" | "summary" | None,
            "start_date": datetime.date | None,
            "end_date": datetime.date | None,
            "filename": str,
            "error": str | None
        }
        """

        filename = Path(filename).name

        activity_match = FilenameParser.ACTIVITY_PATTERN.match(filename)

        if activity_match:

            start = datetime.strptime(
                activity_match.group(1),
                "%Y-%m-%d"
            ).date()

            end = datetime.strptime(
                activity_match.group(2),
                "%Y-%m-%d"
            ).date()

            return {
                "valid": True,
                "file_type": "activity",
                "start_date": start,
                "end_date": end,
                "filename": filename,
                "error": None,
            }

        summary_match = FilenameParser.SUMMARY_PATTERN.match(filename)

        if summary_match:

            start = datetime.strptime(
                summary_match.group(1),
                "%Y-%m-%d"
            ).date()

            end = datetime.strptime(
                summary_match.group(2),
                "%Y-%m-%d"
            ).date()

            return {
                "valid": True,
                "file_type": "summary",
                "start_date": start,
                "end_date": end,
                "filename": filename,
                "error": None,
            }

        return {
            "valid": False,
            "file_type": None,
            "start_date": None,
            "end_date": None,
            "filename": filename,
            "error": "Invalid filename format.",
        }