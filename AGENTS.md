# Dusk Inc. Code Guidelines (Summary for Agents)
This document is a condensed version of the Dusk Code Guidelines, intended for fast alignment by human and AI contributors.

## Philosophy
- Human Centered, Science Focused – solve real problems, build maintainable systems.
- Answer → Abstract → Automate – solve once, reuse, automate.
- Clarity Over Cleverness – descriptive names, explicit logic, no hidden side effects, document everything.
- Iteration Over Perfection – scaffold, test in isolation, version & rollback.
- Modularity Over Monoliths – small units, composable, reusable.
- Explicitness Over Assumption – clear specs, early validation, no “magic values.”
- Sustainability Over Speed – avoid shortcuts; build reusable abstractions.
- Security by Default – encrypt secrets, zero-trust, safe logging.
- Accessibility by Default – WCAG/ARIA compliance, keyboard navigation, contrast requirements.

## Code Conventions
### Patterns
- Pure functions preferred (no hidden state, no side effects).
- Feature-driven design: each function/class/module does one thing.
- Dependency Injection: inject services, don’t hardcode.
- Declarative over Imperative: use expressive constructs (map, filter, comprehensions, etc.).
- Error Handling: fail fast, custom error types, no silent failures.
- Named Types & Interfaces: avoid any/raw dicts; use enums, interfaces, typed errors.
- Composition over Inheritance: build with small, reusable pieces.
- Optimization: clarity first, optimize only with profiling evidence.

### Testing
- Every feature must have unit tests (Red–Green–Refactor).
- Use Arrange–Act–Assert.
- One behavior per test.
- Deterministic and independent tests.
- Test names must describe: function → input → expected outcome.

## Naming Conventions
Variables & Functions → `camelCase`

```ts
let runningTotal = 0;
function calculateSum(values: number[]): number { ... }
```

```python
runningTotal = 0
def calculateSum(values: list[int]) -> int: ...
```

Classes & Components → `PascalCase`
```ts
class UserService { ... }
export function UserCard() { ... }
```

```python
class UserService:
    ...
```
Constants & Enum Members → `UPPER_SNAKE_CASE`

```ts
const MAX_RETRY_COUNT = 5;

enum Role {
  ADMIN = "admin",
  MEMBER = "member"
}
```

```python
MAX_RETRY_COUNT = 5

from enum import Enum
class Role(Enum):
    ADMIN = "admin"
    MEMBER = "member"
```
Enums (Type Names) → `PascalCase`
```ts
enum OrderStatus {
  PENDING = "pending",
  SHIPPED = "shipped"
}
```

```python
class OrderStatus(str, Enum):
    PENDING = "pending"
    SHIPPED = "shipped"

```
- Files → `<feature>.<type>.<extension>`
    - Python: user_core.py, user_test.py
    - TypeScript: users.core.ts, users.test.ts
    - Go: core.go, users_test.go

Tests:
```ts
describe("<function_name>", () => {
    it("<does_meet_condition>__<gives_response>")
})
```

```python
def test_<function_name>__<condition>__<response>():
```


## File Structure (per feature)
Each feature lives under src/ (TS/Go) or app/ (Python).
- index – re-export public API.
- core – domain logic.
- models – types, DTOs, dataclasses.
- enums – closed sets.
- errors – typed exceptions.
- tests – unit tests.
- spec.md – feature spec.

```
# TypeScript
users.core.ts
users.models.ts
users.enums.ts
users.test.ts

# Python
user_core.py
user_models.py
user_test.py

# Go
core.go
models.go
users_test.go
```

## UI Standards
- Atomic Design: organize into atoms, molecules, organisms, templates, pages.
- Each component is a folder with:
    - `Component.tsx` – logic/rendering
    - `Component.scss` – styles
    - `Component.test.tsx` – tests
    - `Component.stories.tsx` – Storybook
    - `Component.spec.md` – spec
    - `index.ts` – re-export

## Accessibility & Internationalization
- Target WCAG 2.2 AA.
- Semantic HTML first; ARIA only when needed.
- Keyboard accessibility, visible focus, sufficient contrast.
- Localize text, units, numbers, dates, and direction (RTL).
- Touch targets ≥44×44px.

## Notes
To Agents, please don't leave comments explaining code. It creates mess.