from enum import StrEnum


class ReceiptStatus(StrEnum):
    COMPLETED = "completed"
    FAILED = "failed"


class BatchStatus(StrEnum):
    OPEN = "open"
    SEALING = "sealing"
    SIGNED = "signed"
