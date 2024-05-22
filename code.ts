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

let ignoreSuffixes = false;

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
        console.log('------Processing image updates------');

        state.files = msg.files as ImageFile[];
        console.log('Selected files:', state.files);

        const selectedNodes = figma.currentPage.selection;

        // Define a set of the node types you're interested in
        const interestedTypes = new Set(['RECTANGLE', 'ELLIPSE', 'POLYGON', 'VECTOR', 'FRAME', 'INSTANCE', 'COMPONENT']);

        // Function to check if a node is of an interested type and has a matching name
        function isInterestedNode(node: SceneNode, fileName: string): boolean {
          // Extract the base node name and file name by removing suffixes if ignoreSuffixes is true
          const nodeName = ignoreSuffixes ? node.name.replace(/[_\s]\d*$/, '') : node.name;
          const baseFileName = fileName.replace(/\.[^/.]+$/, "").replace(/[_\s]\d*$/, '');
        
          console.log(`Comparing node name: "${nodeName}" with file name: "${baseFileName}"`);  // Log node and file names
          const result = interestedTypes.has(node.type) && nodeName === baseFileName;
          console.log(`Is interested node: ${result}`);  // Log the result of the comparison
        
          return result;
        }
        

        for (const file of state.files) {
          console.log(`Processing file: ${file.name}`);
          const correspondingNodes = selectedNodes.filter(node => isInterestedNode(node, file.name));

          if (correspondingNodes.length === 0) {
            console.log(`No matching layers found for file: ${file.name}`);
            figma.ui.postMessage({ type: 'update-fail', text: `No match for file: ${file.name.replace(/\.[^/.]+$/, "")}` });
          }

          for (const node of correspondingNodes) {
            if (nodeHasFills(node)) {
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
        figma.ui.postMessage({ type: 'hide-spinner' });
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

      function hasImageFill(node: SceneNode): boolean {
        if ("fills" in node && Array.isArray(node.fills)) {
          return node.fills.some((fill) => fill.type === "IMAGE");
        }
        return false;
      }

      function findNodesWithImageFill(node: BaseNode, nodesToProcess: SceneNode[]): void {
        if ("children" in node) {
          for (const child of node.children) {
            findNodesWithImageFill(child, nodesToProcess);
          }
        }
        if (isSceneNode(node) && interestedNodeTypes.has(node.type) && hasImageFill(node)) {
          nodesToProcess.push(node);
        }
      }

      function isSceneNode(node: BaseNode): node is SceneNode {
        return 'visible' in node;
      }

      function searchAllNodes() {
        const nodesToProcess: SceneNode[] = [];
        findNodesWithImageFill(figma.currentPage, nodesToProcess);
        figma.currentPage.selection = nodesToProcess;
        console.log(nodesToProcess);
        if (nodesToProcess.length === 0) {
          figma.notify("❌  No layers with Image Fills detected in this document!");
        }
      }

      searchAllNodes();
      break;

    case 'set-dark-mode-setting':
      await figma.clientStorage.setAsync('darkMode', msg.value);
      break;
    case 'get-dark-mode-setting':
      const darkMode = await figma.clientStorage.getAsync('darkMode');
      figma.ui.postMessage({ type: 'dark-mode-setting', value: darkMode });
      break;
    case 'set-ignore-suffixes':
      ignoreSuffixes = msg.value;
      await figma.clientStorage.setAsync('ignore-suffixes-setting', ignoreSuffixes);
      console.log(`Ignore suffixes set to: ${ignoreSuffixes}`);
      break;
    case 'get-ignore-suffixes-setting':
      const ignoreSuffixesSetting = await figma.clientStorage.getAsync('ignore-suffixes-setting');
      ignoreSuffixes = ignoreSuffixesSetting || false;
      figma.ui.postMessage({ type: 'ignore-suffixes-setting', value: ignoreSuffixes });
      console.log(`Ignore suffixes setting from storage: ${ignoreSuffixesSetting}`);
      console.log(`Ignore suffixes is now: ${ignoreSuffixes}`);
      break;
  }
};

function nodeHasFills(node: SceneNode): node is SceneNode & { fills: Paint[] } {
  return "fills" in node;
}
