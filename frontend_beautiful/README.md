# Aition Frontend

React dashboard for the Aition causal AI fairness engine.

The frontend is intentionally a single focused workbench: upload or run an audit, compare standard fairness against causal fairness, inspect the causal graph, review proxy variables, and apply the selected fairness definition to the debiasing step.

## Stack

- React 18
- CRACO / Create React App
- Lucide React icons
- Custom SVG causal graph
- CSS-only visual system in `src/App.css`

## Local Development

```bash
npm install
npm start
```

The app runs on `http://localhost:3000` and proxies API calls to `http://localhost:8000` in development.

To point the frontend at another backend:

```bash
REACT_APP_API_URL=https://your-api.example.com npm start
```

## Production Build

```bash
npm run build
```

The compiled app is emitted to `build/`.

## Frontend Structure

- `src/components/Dashboard.jsx` - main audit workbench and UI states
- `src/components/CausalGraph.jsx` - SVG graph renderer for causal paths
- `src/components/Sidebar.jsx` - application navigation shell
- `src/api.js` - `runAudit` and `runDebias` API calls
- `src/App.css` - dashboard visual system, responsive rules, and animations

## Design Notes

The interface uses a dark professional command-center treatment with high-contrast result cards, color-coded graph semantics, compact controls, and responsive layouts tuned for live demo review.
