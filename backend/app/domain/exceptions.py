class DomainError(Exception):
    """Base domain exception."""


class ReceiptNotFoundError(DomainError):
    pass


class BatchNotFoundError(DomainError):
    pass


class ModelNotLoadedError(DomainError):
    pass


class VerificationError(DomainError):
    pass
