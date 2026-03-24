"""
Geometry Layer — Pattern geometry building, validation and normalization.
"""

from .pattern_geometry_builder import PatternGeometryBuilder, get_pattern_geometry_builder
from .wedge_shape_validator import get_wedge_shape_validator
from .main_render_gate import get_main_render_gate
from .geometry_normalizer import (
    GeometryNormalizer,
    get_geometry_normalizer,
    normalize_pattern,
    normalize_patterns,
)

__all__ = [
    "PatternGeometryBuilder",
    "get_pattern_geometry_builder",
    "get_wedge_shape_validator",
    "get_main_render_gate",
    "GeometryNormalizer",
    "get_geometry_normalizer",
    "normalize_pattern",
    "normalize_patterns",
]
