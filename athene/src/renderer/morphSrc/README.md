# 01 — Hello World

The absolute minimum needed to get a Morpheus app running.

## What you will learn

How to set up a Morpheus app from scratch: define the app, register a node, mark it as root, create the node definition with a module, and render a simple component.

## Concepts & Magic Files Introduced

- App Definition: `app.js` — the app definition with a `nodes` registry (default export required)
- Root Node Definition: `isRoot: true` on a node entry — explicitly marks the root node
- Node Definition: `{nodeId}.node.jsx` — a node definition file (default export required)
- Root Module Definition: `isRoot: true` on a module entry — explicitly marks the root module
- Directory node structure — node config and modules live in a directory
- Module files — each module is a separate `.jsx` file with a default export


## Project File Structure

```
app.js                          ← app definition
nodes/
  Home/
    Home.node.jsx               ← node definition (config only)
    HelloWorld.jsx              ← root module (renders UI)
```

### App Definition

Every Morpheus app starts with `app.js` at the root of `morphSrc/`. It declares which nodes exist in the application.

```javascript
const app = {
  nodes: {
    Home: {
      isRoot: true,
    }
  }
}

export default app;
```

- `nodes` is the only required property. It maps node IDs to their registration config.
- Each key (`Home`) becomes the node's ID — used to locate its files and reference it throughout the app.
- The default export is mandatory. Morpheus reads this file at compile time.

### Root Node Definition

```javascript
Home: {
  isRoot: true,
}
```

`isRoot: true` tells Morpheus that `Home` is the application's entry point — the first node rendered on screen. Every app needs exactly one root node.

### Node Definition

By default, node definitions are located in the `nodes/` directory. A node definition file follows the naming pattern `{nodeId}.node.jsx` — in our case, `Home.node.jsx`. Using the framework's default paths, it lives inside `nodes/{nodeId}/`, giving us the full path `nodes/Home/Home.node.jsx`. It declares the node's modules, among many other resources we will explore in later examples.

```javascript
const node = {
  modules: {
    HelloWorld: {
      isRoot: true,
    }
  }
}

export default node;
```

- `modules` registers the node's modules. Every node needs at least one module. Each entry can carry inline options (like `isRoot: true`) — modules themselves are just React components in separate `.jsx` files.
- Each key (`HelloWorld`) becomes the module's ID — used to locate its `.jsx` file and reference it within the node.
- The default export is mandatory.

### Root Module Definition

```javascript
HelloWorld: {
  isRoot: true,
}
```

`isRoot: true` on a module entry marks it as the node's visual entry point — the first module rendered when the node loads. Every node needs exactly one root module.

By default, module files are located in the node's root directory. The file name matches the module ID, so `HelloWorld` lives at `nodes/Home/HelloWorld.jsx`.

```jsx
export default function HelloWorld() {
  return (
    <div>Hello World!</div>
  )
}
```

- Module files export a default function — a React component.
- The function name should match the module ID.
- This is a plain React component. It receives injected props from the framework (covered in later examples).

## Key Rules

- Every Morpheus app requires an `app.js` file — the app definition — at the root of `morphSrc/`. It must have a default export.
- `app.js` must contain at least a `nodes` property — an object mapping node IDs to their registration entries.
- Every node needs a definition file following the pattern `{nodeId}.node.jsx`. It must have a default export.
- By default, node definitions live at `nodes/{nodeId}/{nodeId}.node.jsx`.
- At least one node must be marked `isRoot: true` in the `nodes` registry of `app.js`.
- Every node definition must contain a `modules` property with at least one module entry.
- At least one module must be marked `isRoot: true` in the node's `modules` registry.
- Each module is a separate `.jsx` file located in the node's directory, named after its module ID (`{moduleId}.jsx`). It must have a default export (a React component).

## Defaults, Conventions & Magic Behavior

- If only one node is registered, it automatically becomes the root — no `isRoot` needed.
- A node named `"Root"` is treated as root by convention — unless another node explicitly has `isRoot: true`.
- A module named `"Root"` is treated as the root module by convention — unless another module explicitly has `isRoot: true`.
- Note: the single-item auto-root only applies to nodes, not modules — a single module still needs `isRoot: true` or the `"Root"` naming convention.