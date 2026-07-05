from pathlib import Path

import pandas as pd


class ExcelLoader:
    """
    Loads TMR Excel files into Pandas DataFrames.
    """

    @staticmethod
    def load_excel(file_path: Path) -> pd.DataFrame:
        """
        Load a single Excel file and normalize column names.
        """

        df = pd.read_excel(
            file_path,
            engine="openpyxl"
        )

        # Normalize column names
        df.columns = (
            df.columns
            .astype(str)
            .str.strip()
            .str.replace('"', '', regex=False)      # Remove quotation marks
            .str.replace("\n", " ", regex=False)
            .str.replace(r"\s+", " ", regex=True)
        )

        return df

    @staticmethod
    def load_multiple(files: list[Path]) -> pd.DataFrame:
        """
        Load multiple Excel files and concatenate them.
        """

        if not files:
            return pd.DataFrame()

        dataframes = []

        for file in files:
            df = ExcelLoader.load_excel(file)
            dataframes.append(df)

        merged = pd.concat(
            dataframes,
            ignore_index=True
        )

        return merged