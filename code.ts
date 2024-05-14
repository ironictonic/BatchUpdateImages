"use strict";

// This function updates the layer names based on the current selection
function updateLayerNames() {
  const layerNames = figma.currentPage.selection.map(node => node.name); // Get names of all selected nodes
  figma.ui.postMessage({ type: 'display-names', names: layerNames });
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

let layerNames: string[] = [];
figma.ui.onmessage = async msg => {
  switch (msg.type) {
    case 'replace-images':
      //console.clear();
      figma.ui.postMessage({ type: 'clear-list' });
      //console.log(`---------Clearing Console Log---------`);
      console.log('------Processing image updates------');

      const files: ImageFile[] = msg.files as ImageFile[];
      const selectedNodes = figma.currentPage.selection; // Get currently selected nodes

      // Define a set of the node types you're interested in
      const interestedTypes = new Set(['RECTANGLE', 'ELLIPSE', 'POLYGON', 'VECTOR', 'FRAME', 'INSTANCE', 'COMPONENT']);

      // Function to check if a node is of an interested type and has a matching name
      function isInterestedNode(node: SceneNode, fileName: string): boolean {
        return interestedTypes.has(node.type) && node.name === fileName.replace(/\.[^/.]+$/, "");
      }

      files.forEach(file => {
        // Filter selected nodes that are of an interested type and have a name matching the file name (without extension)
        const correspondingNodes = selectedNodes.filter(node => isInterestedNode(node, file.name));
        console.log(`RECORDED: ${file.name}`);

        // Debugging: Log when no corresponding nodes are found for a file
        if (correspondingNodes.length === 0) {
          console.log(`No matching layers found for file: ${file.name}`);
          figma.ui.postMessage({ type: 'update-fail', text: `No match for file: ${file.name.replace(/\.[^/.]+$/, "")}` });
        }

        correspondingNodes.forEach(node => {
          const imageHash = figma.createImage(new Uint8Array(file.content)).hash;
          if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE' || node.type === 'POLYGON' || node.type === 'VECTOR' || node.type === 'INSTANCE')
            node.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash }];
          console.log(`SUCCESSFULLY UPDATED: ${file.name}`);
          figma.ui.postMessage({ type: 'update-success', text: `${file.name.replace(/\.[^/.]+$/, "")}` });
        });
      });
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
        // Here you can process the nodesToProcess array as needed
      }

      // Execute the renamed function
      searchAllNodes();
      break;
  }
};