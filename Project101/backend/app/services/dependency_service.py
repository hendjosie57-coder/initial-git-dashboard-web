"""Static import extraction for the dependency graph.

Python imports are resolved with the `ast` module; JS/TS imports with regexes
covering `import ... from`, side-effect imports, `export ... from`, `require()`
and dynamic `import()`. Only imports that resolve to a file *inside* the
repository become links — external packages are ignored by design.
"""

from __future__ import annotations

import ast
import logging
import os
import re
from pathlib import Path

from app import config

logger = logging.getLogger(__name__)

_JS_IMPORT_PATTERNS = (
    re.compile(r"""\bimport\s+[^'";]*?\bfrom\s+['"]([^'"]+)['"]"""),
    re.compile(r"""\bimport\s+['"]([^'"]+)['"]"""),
    re.compile(r"""\bexport\s+[^'";]*?\bfrom\s+['"]([^'"]+)['"]"""),
    re.compile(r"""\brequire\(\s*['"]([^'"]+)['"]\s*\)"""),
    re.compile(r"""\bimport\(\s*['"]([^'"]+)['"]\s*\)"""),
)


def iter_source_files(root: Path) -> list[Path]:
    """All analysable source files under `root`, skipping vendored/build dirs."""
    found: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in config.EXCLUDED_DIRS)
        for name in sorted(filenames):
            if Path(name).suffix in config.SOURCE_EXTENSIONS:
                found.append(Path(dirpath) / name)
    return found


# --- JS / TS ---------------------------------------------------------------------


def _resolve_js_specifier(spec: str, importing_file: Path) -> Path | None:
    """Resolve a relative JS/TS import specifier to an existing repo file."""
    if not spec.startswith("."):
        return None  # bare specifier -> external package
    base = (importing_file.parent / spec).resolve()
    candidates = [base] if base.suffix else []
    candidates += [base.with_name(base.name + ext) for ext in config.JS_RESOLUTION_EXTENSIONS]
    candidates += [base / f"index{ext}" for ext in config.JS_RESOLUTION_EXTENSIONS]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def _js_imports(source: str, importing_file: Path) -> set[Path]:
    resolved: set[Path] = set()
    for pattern in _JS_IMPORT_PATTERNS:
        for spec in pattern.findall(source):
            target = _resolve_js_specifier(spec, importing_file)
            if target:
                resolved.add(target)
    return resolved


# --- Python ----------------------------------------------------------------------


def _resolve_py_module(module: str, search_dirs: list[Path]) -> Path | None:
    parts = module.split(".")
    for base in search_dirs:
        as_file = base.joinpath(*parts).with_suffix(".py")
        if as_file.is_file():
            return as_file
        as_package = base.joinpath(*parts) / "__init__.py"
        if as_package.is_file():
            return as_package
    return None


def _py_imports(source: str, importing_file: Path) -> set[Path]:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return set()

    search_dirs = [importing_file.parent, config.REPO_ROOT]
    resolved: set[Path] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                target = _resolve_py_module(alias.name, search_dirs)
                if target:
                    resolved.add(target)
        elif isinstance(node, ast.ImportFrom):
            if node.level:  # relative import: climb from the file's directory
                base = importing_file.parent
                for _ in range(node.level - 1):
                    base = base.parent
                dirs = [base]
            else:
                dirs = search_dirs
            if node.module:
                target = _resolve_py_module(node.module, dirs)
                if target:
                    resolved.add(target)
            else:  # `from . import x`
                for alias in node.names:
                    target = _resolve_py_module(alias.name, dirs)
                    if target:
                        resolved.add(target)
    return resolved


# --- Public API --------------------------------------------------------------------


def extract_imports(source: str, importing_file: Path) -> set[Path]:
    """Absolute paths of repo-internal files imported by `importing_file`."""
    if importing_file.suffix == ".py":
        targets = _py_imports(source, importing_file)
    else:
        targets = _js_imports(source, importing_file)

    internal: set[Path] = set()
    for target in targets:
        try:
            target.resolve().relative_to(config.REPO_ROOT)
        except ValueError:
            continue
        if target != importing_file:
            internal.add(target.resolve())
    return internal
