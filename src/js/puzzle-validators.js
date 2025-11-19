/**
 * A collection of validation functions for different puzzle topologies.
 */

/**
 * Validates a puzzle with 'ordered' evaluation. The sequence of matches must be exact.
 * This is a generic validator that can be used by any puzzle type.
 * @param {Array<Array<string>>} solutions - The array of solution pairs.
 * @param {Map<string, string>} playerMatches - The player's matches.
 * @returns {boolean}
 */
const validateOrdered = (solutions, playerMatches) => {

    if (playerMatches.size !== solutions.length) return false;

    const playerMatchArray = Array.from(playerMatches.entries());

    for (let i = 0; i < solutions.length; i++) {

        const solutionPair = solutions[i];
        const playerPair = playerMatchArray[i];

        if (playerPair[0] !== solutionPair[0] || playerPair[1] !== solutionPair[1]) {

            return false;
        }
    }

    return true;
};

/**
 * Builds an adjacency list graph from a set of matches.
 * @param {Map<string, string>} matches - The player's matches.
 * @returns {Map<string, Array<string>>} The adjacency list.
 */
const buildAdjacencyList = (matches) => {
    const adj = new Map();
    const addEdge = (u, v) => {
        if (!adj.has(u)) adj.set(u, []);
        adj.get(u).push(v);
    };

    for (const [u, v] of matches.entries()) {
        addEdge(u, v);
        addEdge(v, u);
    }
    return adj;
};

/**
 * Validates a 'chain' type puzzle.
 * For 'unordered', it verifies the topological integrity of the chain.
 * @param {Array<Array<string>>} solutions - The array of solution pairs.
 * @param {Map<string, string>} playerMatches - The player's matches.
 * @param {'ordered' | 'unordered'} evaluation - The evaluation rule.
 * @returns {boolean}
 */
export const validateChain = (solutions, playerMatches, evaluation) => {
    if (evaluation === 'ordered') {
        return validateOrdered(solutions, playerMatches);
    }

    // Unordered 'chain' logic
    if (playerMatches.size !== solutions.length) return false;

    const adj = buildAdjacencyList(playerMatches);

    // Ensure all nodes from the matches are included in the node list,
    // not just the keys from the adjacency list. A node might only appear as a value.
    const allNodesInMatches = new Set();
    for (const [u, v] of playerMatches.entries()) {
        allNodesInMatches.add(u);
        allNodesInMatches.add(v);
    }    

    if (allNodesInMatches.size !== solutions.length + 1) return false;
    
    // A valid chain must have exactly two endpoints (nodes with degree 1).
    const endpoints = Array.from(allNodesInMatches).filter(node => adj.get(node)?.length === 1);
    if (endpoints.length !== 2) return false;

    // Traverse the chain from one endpoint and ensure we visit all nodes.
    const visited = new Set();
    const stack = [endpoints[0]];
    while (stack.length > 0) {
        const node = stack.pop();
        if (visited.has(node)) continue;
        visited.add(node);
        adj.get(node).forEach(neighbor => {
            if (!visited.has(neighbor)) {
                stack.push(neighbor);
            }
        });
    }

    // The number of visited nodes must equal the total number of unique nodes.
    return visited.size === allNodesInMatches.size;
};

/**
 * Validates a 'ring' type puzzle.
 * For 'unordered', it verifies the topological integrity of the ring.
 * @param {Array<Array<string>>} solutions - The array of solution pairs.
 * @param {Map<string, string>} playerMatches - The player's matches.
 * @param {'ordered' | 'unordered'} evaluation - The evaluation rule.
 * @returns {boolean}
 */
export const validateRing = (solutions, playerMatches, evaluation) => {
    if (evaluation === 'ordered') {
        return validateOrdered(solutions, playerMatches);
    }

    // Unordered 'ring' logic
    if (playerMatches.size !== solutions.length || solutions.length < 3) return false;

    const adj = buildAdjacencyList(playerMatches);
    const nodes = Array.from(adj.keys());

    // A valid ring of N matches must involve N unique nodes, and each must have 2 connections.
    if (nodes.length !== solutions.length) return false;
    if (nodes.some(node => adj.get(node).length !== 2)) return false;

    // Traverse the graph from an arbitrary start and ensure it's one contiguous component.
    const visited = new Set();
    const stack = [nodes[0]];
    while (stack.length > 0) {
        const node = stack.pop();
        if (visited.has(node)) continue;
        visited.add(node);
        adj.get(node).forEach(neighbor => {
            if (!visited.has(neighbor)) {
                stack.push(neighbor);
            }
        });
    }

    return visited.size === nodes.length;
};

/**
 * Validates a 'set' type puzzle.
 * For 'unordered', it checks if the player's matches are a subset of the solutions.
 * @param {Array<Array<string>>} solutions - The array of solution pairs.
 * @param {Map<string, string>} playerMatches - The player's matches.
 * @param {'ordered' | 'unordered'} evaluation - The evaluation rule.
 * @returns {boolean}
 */
export const validateSet = (solutions, playerMatches, evaluation) => {

    if (evaluation === 'ordered') {

        return validateOrdered(solutions, playerMatches);
    }

    // Unordered 'set' logic
    if (playerMatches.size !== solutions.length) return false;

    const solutionSet = new Set(solutions.map(s => s.slice().sort().join('|')));

    for (const [playerKey, playerValue] of playerMatches.entries()) {

        const playerPair = [playerKey, playerValue].sort().join('|');

        if (!solutionSet.has(playerPair)) {

            return false;
        }
    }

    return true;
};

/**
 * Validates a 'star' type puzzle.
 * For 'unordered', it identifies the hub and checks if all spokes are correctly matched to it.
 * @param {Array<Array<string>>} solutions - The array of solution pairs.
 * @param {Map<string, string>} playerMatches - The player's matches.
 * @param {'ordered' | 'unordered'} evaluation - The evaluation rule.
 * @returns {boolean}
 */
export const validateStar = (solutions, playerMatches, evaluation) => {

    if (evaluation === 'ordered') {

        return validateOrdered(solutions, playerMatches);
    }

    // Unordered 'star' logic
    if (playerMatches.size !== solutions.length) return false;

    const idCounts = solutions.flat().reduce((acc, id) => {

        acc[id] = (acc[id] || 0) + 1;

        return acc;

    }, {});

    const starCenter = Object.keys(idCounts).find(id => idCounts[id] === solutions.length);

    if (!starCenter) return false; // Invalid star puzzle definition

    const solutionSpokes = new Set(solutions.map(s => s.find(id => id !== starCenter)));

    for (const [playerKey, playerValue] of playerMatches.entries()) {

        const isKeyCenter = playerKey === starCenter;
        const isValueCenter = playerValue === starCenter;

        if (!((isKeyCenter && solutionSpokes.has(playerValue)) || (isValueCenter && solutionSpokes.has(playerKey)))) {

            return false; // Invalid match found
        }
    }

    return true;
};
