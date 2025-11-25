/**
 * Wraps a number around a given range.
 *
 * @param {number} value The number to wrap.
 * @param {number} max The upper bound of the range (exclusive).
 * @returns {number} The wrapped number.
 */
export function wrap(value, max) {
    return (value % max + max) % max;
}
