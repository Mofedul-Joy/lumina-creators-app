"""Creator-facing gamification schema (Feature 7, BUILD_SPEC.md 3.9)."""
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel


class CreatorGamificationOut(BaseModel):
    rank: str  # computed gemstone rank: bronze|sapphire|gold|emerald|amber|ruby
    rank_label: str  # "Gold"
    xp: int
    xp_to_next: int  # xp needed to reach next tier (0 if already top rank)
    next_rank: Optional[str] = None
    streak_days: int = 0
    awards: List[str] = []
    total_views: int = 0
    total_earned: Decimal = Decimal("0")
    total_posts: int = 0
