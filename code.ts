"use strict";

// This function updates the layer names based on the current selection
function updateLayerNames() {
  const layerNames = figma.currentPage.selection.map(node => {
    if (hasImageFill(node)) {
      return node.name;
    } else {
      return `<span class="warning-symbol">⚠</span> ${node.name}`;
    }
  }); // Get names of all selected nodes

  const warningMessage = layerNames.some(name => name.includes('⚠'))
    ? "Warning: Some layer(s) selected do not have Image Fills!"
    : "";

  figma.ui.postMessage({ type: 'display-names', names: layerNames });
  figma.ui.postMessage({ type: 'update-message', message: `${layerNames.length} layers selected.` });
  figma.ui.postMessage({ type: 'warning-message', message: warningMessage });
}

// This function checks if a node has an Image Fill
function hasImageFill(node: SceneNode): boolean {
  // Check if 'fills' is an array and not 'figma.mixed'
  if ("fills" in node && Array.isArray(node.fills)) {
    return node.fills.some((fill) => fill.type === "IMAGE");
  }
  return false;
}

// Set up the event listener for selection changes
figma.on('selectionchange', () => {
  updateLayerNames();
});

figma.showUI(__html__, { width: 400, height: 500 });

updateLayerNames();

// Define a type for the image files
interface ImageFile {
  name: string;
  content: ArrayBuffer;
}

// Function to clear the state
function clearState() {
  state.files = [];
  state.processing = false;
  state.imageHashes.clear();
}

// Define a state object to manage the processing status
const state = {
  files: [] as ImageFile[],
  processing: false,
  imageHashes: new Map<string, string>()
};

figma.ui.onmessage = async msg => {
  switch (msg.type) {
    case 'replace-images':
      if (state.processing) {
        console.log("Processing already in progress, please wait.");
        return;
      }
      state.processing = true;
      try {
        figma.ui.postMessage({ type: 'clear-list' });
        console.clear();  // Clear the console log
        console.log('------Processing image updates------');

        state.files = msg.files as ImageFile[];
        console.log('Selected files:', state.files);  // Print the selected file data

        const selectedNodes = figma.currentPage.selection; // Get currently selected nodes

        // Define a set of the node types you're interested in
        const interestedTypes = new Set(['RECTANGLE', 'ELLIPSE', 'POLYGON', 'VECTOR', 'FRAME', 'INSTANCE', 'COMPONENT']);

        // Function to check if a node is of an interested type and has a matching name
        function isInterestedNode(node: SceneNode, fileName: string): boolean {
          return interestedTypes.has(node.type) && node.name === fileName.replace(/\.[^/.]+$/, "");
        }

        for (const file of state.files) {
          // Filter selected nodes that are of an interested type and have a name matching the file name (without extension)
          const correspondingNodes = selectedNodes.filter(node => isInterestedNode(node, file.name));
          console.log(`RECORDED: ${file.name}`);

          // Debugging: Log when no corresponding nodes are found for a file
          if (correspondingNodes.length === 0) {
            console.log(`No matching layers found for file: ${file.name}`);
            figma.ui.postMessage({ type: 'update-fail', text: `No match for file: ${file.name.replace(/\.[^/.]+$/, "")}` });
          }

          for (const node of correspondingNodes) {
            if (nodeHasFills(node)) {
              // Clear the previous image fills before creating a new one
              node.fills = [];
              let imageHash: string;
              if (state.imageHashes.has(file.name)) {
                imageHash = state.imageHashes.get(file.name) as string;
              } else {
                imageHash = figma.createImage(new Uint8Array(file.content)).hash;
                state.imageHashes.set(file.name, imageHash);
              }
              node.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash }];
              console.log(`SUCCESSFULLY UPDATED: ${file.name}`);
              figma.ui.postMessage({ type: 'update-success', text: `${file.name.replace(/\.[^/.]+$/, "")}` });
            }
          }
        }
      } catch (error) {
        console.error('Error during replace images operation:', error);
        figma.ui.postMessage({ type: 'update-fail', text: 'An error occurred during image replacement.' });
      } finally {
        // Send a message to hide the spinner
        figma.ui.postMessage({ type: 'hide-spinner' });

        // Reset the processing state and clear the state
        clearState();
      }
      break;

    case 'select-all-images':
      await figma.loadAllPagesAsync();
      const interestedNodeTypes = new Set([
        "RECTANGLE",
        "ELLIPSE",
        "POLYGON",
        "VECTOR",
        "FRAME",
        "INSTANCE",
        "COMPONENT",
      ]);

      // This function checks if a node has an Image Fill
      function hasImageFill(node: SceneNode): boolean {
        // Check if 'fills' is an array and not 'figma.mixed'
        if ("fills" in node && Array.isArray(node.fills)) {
          return node.fills.some((fill) => fill.type === "IMAGE");
        }
        return false;
      }

      // This function traverses the document and finds nodes with Image Fill
      function findNodesWithImageFill(node: BaseNode, nodesToProcess: SceneNode[]): void {
        if ("children" in node) {
          // If the node has children, traverse them
          for (const child of node.children) {
            findNodesWithImageFill(child, nodesToProcess);
          }
        }
        // Type guard to ensure node is a SceneNode before checking interestedNodeTypes and hasImageFill
        if (isSceneNode(node) && interestedNodeTypes.has(node.type) && hasImageFill(node)) {
          nodesToProcess.push(node);
        }
      }

      // Type guard function to ensure a node is a SceneNode
      function isSceneNode(node: BaseNode): node is SceneNode {
        return 'visible' in node;
      }

      // Renamed main function to searchAllNodes
      function searchAllNodes() {
        const nodesToProcess: SceneNode[] = [];
        findNodesWithImageFill(figma.currentPage, nodesToProcess);
        figma.currentPage.selection = nodesToProcess;
        console.log(nodesToProcess);
        // Display a notification if no layers with Image Fills are found
        if (nodesToProcess.length === 0) {
          figma.notify("❌  No layers with Image Fills detected in this document!");
        }
      }

      // Execute the renamed function
      searchAllNodes();
      break;

    case 'set-dark-mode-setting':
      await figma.clientStorage.setAsync('darkMode', msg.value);
      break;
    case 'get-dark-mode-setting':
      const darkMode = await figma.clientStorage.getAsync('darkMode');
      figma.ui.postMessage({ type: 'dark-mode-setting', value: darkMode });
      break;
  }
};

// Type guard to check if a node has fills
function nodeHasFills(node: SceneNode): node is SceneNode & { fills: Paint[] } {
  return "fills" in node;
}
