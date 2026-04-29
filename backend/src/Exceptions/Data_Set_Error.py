from EMail_Service import send_admin_email

class DataSetError(RuntimeError):
    """
    Raised when a searched value cannot be found in a dataset/table.
    Author: Jonas Dorner (@OilersLD)
    """

    def __init__(
        self,
        message: str,
        *,
        dataset: str,
        column: str,
        row: str,
    ):
        super().__init__(message)
        self.dataset = dataset   # z.B. Dateipfad / Tabellenname
        self.column = column   # gesuchte Spalte (Kategorie)
        self.row = row         # z.B. AGS oder Row-Identifier
        send_admin_email("DataSetError in KommMa Tool",
            f"DataSetError raised in KommMa Tool for more information see the logs.\n\n We found the following details about the error:\n\nMessage: {message}\n Dataset: {dataset}\n Column: {column}\nRow: {row}"
        )



def raise_data_set_error(*, message: str, dataset: str, column: str, row: str) -> None:
    raise DataSetError(message, dataset=str(dataset), column=column, row=row)
