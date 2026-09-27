from enum import Enum


class Level(str, Enum):
    
    BEGINNER = "BEGINNER"
    INTERMEDIATE = "INTERMEDIATE"
    ADVANCED = "ADVANCED"


class TechnologyKind(str, Enum):
    
    MASTERED = "MASTERED"
    LEARNING = "LEARNING"


class ProjectStatus(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"


class VacancyStatus(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"


class ApplicationStatus(str, Enum):
   
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELED = "CANCELED"
