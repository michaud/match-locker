const { useState, useEffect, useRef } = React;

function generateUUID() {
    // A simple and effective way to generate a UUID in modern browsers
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

function SlideItem({ slide, index, onUpdate, onRemove, isNew }) {

    const nameInputRef = useRef(null);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        onUpdate(index, { ...slide, [name]: value });
    };

    useEffect(() => {
        // If this is a newly added slide, focus its name input
        if (isNew && nameInputRef.current) {

            nameInputRef.current.focus();
        }
    }, [isNew]);

    return (
        <div className="list-item">
            <div className="form-group">
                <div className="item-header">
                    <label htmlFor={`slide-name-${index}`}>Slide Name</label> <button onClick={(e) => { e.stopPropagation(); onRemove(index); }} className="remove-button" title="Remove Slide"><img src="style/trash.svg" alt="Remove" /></button>
                </div>
                <input
                    type="text"
                    id={`slide-name-${index}`}
                    name="name"
                    value={slide.name}
                    placeholder="Enter slide name..."
                    onChange={handleInputChange}
                    ref={nameInputRef}
                />
            </div>
            <div className="form-group">
                <label htmlFor={`slide-img-${index}`}>Image Path</label>
                <input
                    type="text"
                    id={`slide-img-${index}`}
                    name="img"
                    value={slide.img}
                    placeholder="path/to/image.jpg"
                    onChange={handleInputChange}
                />
            </div>
            <small className="item-id">{slide.id}</small>
        </div>
    );
}

function MatchEditor({ puzzle, onUpdate, sliders }) {

    const [sourceSlideId, setSourceSlideId] = useState(null);
    const matchContainerRef = useRef(null);
    const [lines, setLines] = useState([]);

    // Refactored to be more robust. It can handle missing or incomplete slider props.
    const slider1 = sliders && sliders.length > 0 ? sliders[0] : null;
    const slider2 = sliders && sliders.length > 1 ? sliders[1] : null;

    useEffect(() => {
        // This effect now only runs when the puzzle or sliders change, not on scroll.
        if (!matchContainerRef.current || !puzzle || !slider1 || !slider2) return;

        const container = matchContainerRef.current;

        const newLines = [];
        (puzzle.matches || []).forEach((match, i) => {

            const [sourceId, targetId] = match.match;

            // Find the source and target elements, regardless of which column they are in.
            const sourceEl = container.querySelector(`[data-slide-id="${sourceId}"]`);
            const targetEl = container.querySelector(`[data-slide-id="${targetId}"]`);

            if (sourceEl && targetEl) {
                const sourceIsLeft = sourceEl.closest('.match-slide-list.left');

                // Determine the start and end points based on which column the source is in.
                const y1 = sourceEl.offsetTop + sourceEl.offsetHeight / 2;
                const y2 = targetEl.offsetTop + targetEl.offsetHeight / 2;

                const x1 = sourceIsLeft ? "0" : "100%";
                const x2 = sourceIsLeft ? "100%" : "0";

                newLines.push({
                    key: `${sourceId}-${targetId}-${i}`,
                    x1: x1,
                    y1: y1,
                    x2: x2,
                    y2: y2,
                });
            }
        });

        setLines(newLines);

    }, [puzzle, slider1, slider2]); // Rerun only when the data changes.

    if (!puzzle) {

        return <div className="matches-section"><p>Select a puzzle to edit its matches.</p></div>;
    }

    if (!slider1 || !slider2) {

        return <div className="matches-section"><p>Select two different slide groups above to create matches.</p></div>;
    }

    if (!slider1.slides || !slider2.slides) {

        return <div className="matches-section"><p>Selected groups must contain slides to create matches.</p></div>;
    }

    const handleSlideClick = (slideId, sliderId) => {
        // If there is no source slide selected, this click sets the source.
        if (!sourceSlideId) {

            setSourceSlideId(slideId);

            return;
        }

        // If a source slide IS selected, this click is the target.
        const targetSlideId = slideId;

        // Check if this exact match already exists.
        const existingMatchIndex = puzzle.matches.findIndex(m =>
            (m.match[0] === sourceSlideId && m.match[1] === targetSlideId) ||
            (m.match[1] === sourceSlideId && m.match[0] === targetSlideId)
        );

        if (existingMatchIndex > -1) {
            // If the match exists, remove it (undo).
            onUpdate({ ...puzzle, matches: puzzle.matches.filter((_, i) => i !== existingMatchIndex) });

        } else {
            // If the match does not exist, create it.
            onUpdate({ ...puzzle, matches: [...puzzle.matches, { match: [sourceSlideId, targetSlideId] }] });
        }

        // Reset the source selection after any action (create or undo).
        setSourceSlideId(null);
    };

    // Create a map of slide IDs to their order number for ordered puzzles.
    const slideOrderMap = new Map();

    if (puzzle.evaluation === 'ordered') {

        let orderCounter = 1;

        (puzzle.matches || []).forEach(match => {

            const [sourceId, targetId] = match.match;

            if (!slideOrderMap.has(sourceId)) {

                slideOrderMap.set(sourceId, orderCounter++);
            }

            if (!slideOrderMap.has(targetId)) {

                slideOrderMap.set(targetId, orderCounter++);
            }
        });
    }

    const renderSlideList = (slider, side) => (
        <div className={`match-slide-list ${side}`}>
            <h4>{slider.slidertitle}</h4>
            <ul>
                {slider.slides.map(slide => (
                    <li
                        key={slide.id}
                        data-slide-id={slide.id}
                        className={sourceSlideId === slide.id ? 'source-selected' : ''}
                        onClick={() => handleSlideClick(slide.id, slider.id)}
                    >
                        {slideOrderMap.has(slide.id) && (
                            <span className="match-order-number">{slideOrderMap.get(slide.id)}</span>
                        )}
                        {slide.name} 
                    </li>
                ))}
            </ul>
        </div>
    );

    return (
        <div className="form-section matches">
            <h3>Matches for "{puzzle.puzzletitle || 'Untitled Puzzle'}"</h3>
            <div className="match-editor-container" ref={matchContainerRef}>
                {renderSlideList(slider1, "left")}
                <svg className="match-lines">
                    <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" />
                        </marker>
                    </defs>
                    {lines.map(line => (
                        <line key={line.key} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                            markerEnd={puzzle.evaluation === 'ordered' ? "url(#arrowhead)" : "none"} />
                    ))}
                </svg>
                {renderSlideList(slider2, "right")}
            </div>
        </div>
    );
}

function PuzzleItem({ puzzle, index, onUpdate, onRemove, allSlides, onSelect, isSelected }) {

    const handleInputChange = (e) => {

        const { name, value } = e.target;
        onUpdate(index, { ...puzzle, [name]: value });
    };

    return (
        <div className={`list-item ${isSelected ? 'selected' : ''}`} onClick={() => onSelect(index)}>
            <div className="item-header">
                <label htmlFor={`puzzle-title-${index}`}>Puzzle</label>
                <button onClick={() => onRemove(index)} className="remove-button" title="Remove Puzzle"><img src="style/trash.svg" alt="Remove" /></button>
            </div>
            <div className="form-group">
                <label htmlFor={`puzzle-title-${index}`}>Puzzle Title</label>
                <input type="text" id={`adv-puzzle-title-${index}`} name="puzzletitle" value={puzzle.puzzletitle} placeholder="Enter puzzle title..." onChange={handleInputChange} />
            </div>
            <div className="form-group">
                <label htmlFor={`puzzle-instructions-${index}`}>Instructions</label>
                <textarea id={`adv-puzzle-instructions-${index}`} name="instructions" value={puzzle.instructions} placeholder="Enter instructions..." onChange={handleInputChange} />
            </div>
            <div className="form-group">
                <label htmlFor={`puzzle-type-${index}`}>Type (Topology)</label>
                <select id={`puzzle-type-${index}`} name="type" value={puzzle.type || 'set'} onChange={handleInputChange}>
                    <option value="set">Set (Independent Pairs)</option>
                    <option value="chain">Chain (A-B, B-C)</option>
                    <option value="ring">Ring (A-B, B-C, C-A)</option>
                    <option value="star">Star (Multiple to one)</option>
                </select>
            </div>
            <div className="form-group">
                <label htmlFor={`puzzle-evaluation-${index}`}>Evaluation Rule</label>
                <select id={`puzzle-evaluation-${index}`} name="evaluation" value={puzzle.evaluation || 'unordered'} onChange={handleInputChange}>
                    <option value="unordered">Unordered</option>
                    <option value="ordered">Ordered</option>
                </select>
            </div>
        </div>
    );
}

function PuzzleList({ puzzles, onAdd, onUpdate, onRemove, onSelect, selectedIndex }) {

    return (
        <div className="form-section puzzles">
            <h3>Puzzles</h3>
            {puzzles.map((puzzle, index) => (
                <PuzzleItem key={index} puzzle={puzzle} index={index} onUpdate={onUpdate} onRemove={onRemove} onSelect={onSelect} isSelected={index === selectedIndex} />
            ))}
            <button onClick={onAdd}>Add New Puzzle</button>
        </div>
    );
}

function SlideGroupItem({ group, index, onUpdate, onRemove, onSelect, isSelected }) {

    const handleInputChange = (e) => {

        const { name, value } = e.target;
        onUpdate(index, { ...group, [name]: value });
    };

    return (
        <div className={`list-item ${isSelected ? 'selected' : ''}`} onClick={() => onSelect(index)}>
            <div className="item-header">
                <label htmlFor={`group-name-${index}`}>Group Name</label>
                <button onClick={() => onRemove(index)} className="remove-button" title="Remove Group"><img src="style/trash.svg" alt="Remove" /></button>
            </div>
            <input
                type="text"
                id={`group-name-${index}`}
                name="group_name"
                value={group.group_name}
                placeholder="Enter group name..."
                onChange={handleInputChange}
            />
            {/* Placeholder for slides within this group */}
            <div className="nested-list-placeholder">
                <p>{group.slides.length} slide(s) in this group.</p>
            </div>
            <small className="item-id">{group.group_id}</small>
        </div>
    );
}

function AdvancedSlideList({ slides, onAdd, onUpdate, onRemove }) {

    if (!slides) return null; // Don't render if no slides array is provided

    return (
        <div className="form-section slides-in-group">
            <h3>Slides in Selected Group</h3>
            <div className="slide-list-container">
                {slides.map((slide, index) => (
                    <SlideItem // Re-using the SlideItem component from the simple editor
                        key={index}
                        slide={slide}
                        index={index}
                        onUpdate={onUpdate}
                        onRemove={onRemove}
                        isNew={slide.isNew}
                    />
                ))}
            </div>
            <button onClick={onAdd}>Add Slide to Group</button>
        </div>
    );
}

function PuzzleSlotItem({ slot, index, onUpdate, onRemove, onDirectionChange, puzzles, slideGroups }) {
    // This effect resets the host/guest groups if the selected puzzle changes.
    useEffect(() => {

        const puzzle = puzzles.find(p => p.puzzle_id === slot.activates_puzzle_id);

        onUpdate(index, {
            ...slot,
            host_group_id: puzzle?.host_group_id || '',
            guest_group_id: puzzle?.guest_group_id || ''
        });

    }, [slot.activates_puzzle_id]);

    const handleInputChange = (e) => {

        const { name, value } = e.target;
        let updatedSlot = { ...slot, [name]: value };

        if (name === 'host_direction' || name === 'guest_direction') {

            const groupId = name === 'host_direction' ? slot.host_group_id : slot.guest_group_id;
            onDirectionChange(groupId, value);

            return; // The parent will handle the full state update.
        }

        const isNumber = e.target.type === 'number';

        if (isNumber) {
            // Handle empty string to prevent NaN, default to 0.
            const numValue = value === '' ? 0 : parseInt(value, 10);
            updatedSlot[name] = numValue;

        } else {
            // When the puzzle changes, the useEffect above will handle resetting host/guest.
            updatedSlot[name] = value;
        }

        onUpdate(index, updatedSlot);
    };

    // The list of all available sliders/groups for the dropdowns.
    const puzzle = puzzles.find(p => p.puzzle_id === slot.activates_puzzle_id);

    return (
        <div className="list-item">
            <div className="item-header">
                <label>Puzzle Slot at Index: {slot.at_index}</label>
                <button onClick={() => onRemove(index)} className="remove-button" title="Remove Slot"><img src="style/trash.svg" alt="Remove" /></button>
            </div>
            <div className="form-group">
                <label>Activates Puzzle</label>
                <select name="activates_puzzle_id" value={slot.activates_puzzle_id || ''} onChange={handleInputChange}>
                    <option key="placeholder-puzzle" value="">-- Select Puzzle --</option>
                    {puzzles.map(p => <option key={p.puzzle_id} value={p.puzzle_id}>{p.puzzletitle || "Untitled Puzzle"}</option>)}
                </select>
            </div>
            <div className="form-row">
                <div className="form-group">
                    <label>Host Group</label>{slideGroups.find(g => g.group_id === puzzle?.host_group_id)?.group_name || 'N/A'}
                </div>
                <div className="form-group">
                    <label>Guest Group</label>{slideGroups.find(g => g.group_id === puzzle?.guest_group_id)?.group_name || 'N/A'}
                </div>
            </div>

            <div className="form-row">
                <div className="form-group">
                    <label>Host Direction</label>
                    <select name="host_direction" value={slot.host_direction || 'horizontal'} onChange={handleInputChange} disabled={!slot.activates_puzzle_id}>
                        <option value="horizontal">Horizontal</option>
                        <option value="vertical">Vertical</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Guest Direction</label>
                    <select name="guest_direction" value={slot.guest_direction || 'vertical'} onChange={handleInputChange} disabled={!slot.activates_puzzle_id}>
                        <option value="horizontal">Horizontal</option>
                        <option value="vertical">Vertical</option>
                    </select>
                </div>
            </div>
            <div className="form-group">
                <label>Host slot Index</label>
                <input type="number" name="at_index" value={slot.at_index} onChange={handleInputChange} min="0" />
            </div>
            <div className="form-group">
                <label>Guest slot Index</label>
                <input type="number" name="guest_align_index" value={slot.guest_align_index || 0} onChange={handleInputChange} min="0" />
            </div>
            <small className="item-id">{slot.slot_id}</small>
        </div>
    );
}

function LayoutEditor({ layout, puzzles, slideGroups, onUpdate }) {

    const handleDirectionChange = (changedGroupId, newDirection) => {

        if (!layout.puzzle_slots || !changedGroupId) return;

        const oppositeDirection = newDirection === 'horizontal' ? 'vertical' : 'horizontal';

        const newSlots = layout.puzzle_slots.map(slot => {

            let newSlot = { ...slot };

            // Rule 1: Propagate the change to all occurrences of the group.
            if (newSlot.host_group_id === changedGroupId) {

                newSlot.host_direction = newDirection;

            }

            if (newSlot.guest_group_id === changedGroupId) {

                newSlot.guest_direction = newDirection;
            }

            // Rule 2: If this slot contains the changed group, enforce opposite direction on its partner.
            if (newSlot.host_group_id === changedGroupId) {

                newSlot.guest_direction = oppositeDirection;

            } else if (newSlot.guest_group_id === changedGroupId) {

                newSlot.host_direction = oppositeDirection;
            }

            return newSlot;
        });

        onUpdate({ ...layout, puzzle_slots: newSlots });
    };

    const addPuzzleSlot = () => {

        const newSlot = {
            slot_id: generateUUID(),
            activates_puzzle_id: "",
            host_group_id: "",
            guest_group_id: "",
            at_index: 0,
            guest_align_index: 0,
            host_direction: "horizontal",
            guest_direction: "vertical"
        };

        const currentSlots = layout?.puzzle_slots || [];
        onUpdate({ ...layout, puzzle_slots: [...currentSlots, newSlot] });
    };

    const updatePuzzleSlot = (index, updatedSlot) => {

        if (!layout.puzzle_slots) return;

        const newSlots = [...layout.puzzle_slots];
        newSlots[index] = updatedSlot;
        onUpdate({ ...layout, puzzle_slots: newSlots });
    };

    const removePuzzleSlot = (index) => {

        if (!layout.puzzle_slots) return;

        const newSlots = layout.puzzle_slots.filter((_, i) => i !== index);
        onUpdate({ ...layout, puzzle_slots: newSlots });
    };

    return (
        <div className="form-section">
            <h3>Layout</h3>
            <div className="layout-slots-section">
                {layout?.puzzle_slots?.map((slot, index) => (
                    <PuzzleSlotItem key={slot.slot_id || index} slot={slot} index={index} onUpdate={updatePuzzleSlot} onRemove={removePuzzleSlot} onDirectionChange={handleDirectionChange} puzzles={puzzles} slideGroups={slideGroups} />
                ))}
                <button onClick={addPuzzleSlot}>Add Puzzle Slot</button>
            </div>
        </div>
    );
}

function LayoutVisualizer({
    layout,
    slideGroups,
    svgWidth = 800,
    svgHeight = 600,
    slideWidth = 80,
    slideHeight = 50,
    gap = 5
}) {

    const [renderedElements, setRenderedElements] = useState(null);

    useEffect(() => {

        const puzzleSlots = layout?.puzzle_slots || [];

        if (puzzleSlots.length === 0) {

            setRenderedElements(<p>Define sliders and puzzle slots to see the visualization.</p>);

            return;
        }

        // Create a map of all unique groups mentioned in slots and their directions
        const allGroupsInLayout = new Map();

        puzzleSlots.forEach(slot => {

            if (slot.host_group_id && !allGroupsInLayout.has(slot.host_group_id)) {

                allGroupsInLayout.set(slot.host_group_id, { id: slot.host_group_id, direction: slot.host_direction });
            }

            if (slot.guest_group_id && !allGroupsInLayout.has(slot.guest_group_id)) {

                allGroupsInLayout.set(slot.guest_group_id, { id: slot.guest_group_id, direction: slot.guest_direction });
            }
        });

        const allGuestGroupIds = new Set(puzzleSlots.map(s => s.guest_group_id));
        const rootGroups = Array.from(allGroupsInLayout.values()).filter(g => !allGuestGroupIds.has(g.id));

        const elements = [];
        const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        const visited = new Set();

        const calculateLayoutRecursive = (groupId, currentX, currentY) => {

            if (visited.has(groupId)) return;

            visited.add(groupId);

            const groupInfo = allGroupsInLayout.get(groupId);
            const slideGroup = slideGroups.find(g => g.group_id === groupId);

            if (!slideGroup) return;

            const isHorizontal = groupInfo.direction === 'horizontal';
            const guests = puzzleSlots.filter(slot => slot.host_group_id === groupId);

            // Calculate bounds for the current slider
            const sliderWidthCalc = isHorizontal ? slideGroup.slides.length * (slideWidth + gap) - gap : slideWidth;
            const sliderHeightCalc = isHorizontal ? slideHeight : slideGroup.slides.length * (slideHeight + gap) - gap;
            bounds.minX = Math.min(bounds.minX, currentX);
            bounds.minY = Math.min(bounds.minY, currentY);
            bounds.maxX = Math.max(bounds.maxX, currentX + sliderWidthCalc);
            bounds.maxY = Math.max(bounds.maxY, currentY + sliderHeightCalc);

            // Add slide elements to the list
            slideGroup.slides.forEach((slide, index) => {

                const x = isHorizontal ? currentX + index * (slideWidth + gap) : currentX;
                const y = isHorizontal ? currentY : currentY + index * (slideHeight + gap);

                elements.push(
                    <g key={`slide-${groupId}-${slide.id}`}>
                        <rect x={x} y={y} width={slideWidth} height={slideHeight} className={`slide-rect ${isHorizontal ? 'horizontal-slide' : 'vertical-slide'}`} />
                        <text x={x + slideWidth / 2} y={isHorizontal ? y + slideHeight / 2 + 5 : y + slideHeight - 5} textAnchor="middle" className="slide-text">
                            {slide.name.substring(0, 10)}
                        </text>
                    </g>
                );
            });

            // Add highlight and recurse for guests
            guests.forEach(slot => {

                const atIndex = slot.at_index || 0;
                const guestAlignIndex = slot.guest_align_index || 0;

                const highlightX = isHorizontal ? currentX + atIndex * (slideWidth + gap) : currentX;
                const highlightY = isHorizontal ? currentY : currentY + atIndex * (slideHeight + gap);

                elements.push(
                    <rect key={slot.slot_id || `slot-${slot.host_group_id}-${slot.guest_group_id}`} x={highlightX} y={highlightY} width={slideWidth} height={slideHeight} className="highlight-slot" />
                );

                let nextX, nextY;

                if (isHorizontal) {

                    nextX = currentX + atIndex * (slideWidth + gap);
                    nextY = currentY - (guestAlignIndex * (slideHeight + gap));

                } else {

                    nextY = currentY + atIndex * (slideHeight + gap);
                    nextX = currentX - (guestAlignIndex * (slideWidth + gap));
                }

                calculateLayoutRecursive(slot.guest_group_id, nextX, nextY);
            });
        };

        if (rootGroups.length === 0 && puzzleSlots.length > 0) {
            // Handle case with no root (e.g., a single ring)
            calculateLayoutRecursive(puzzleSlots[0].host_group_id, 0, 0);

        } else {

            rootGroups.forEach(root => calculateLayoutRecursive(root.id, 0, 0));
        }
        // Start calculation from a neutral origin (0,0)

        // Calculate centering offset
        const contentWidth = bounds.maxX - bounds.minX;
        const contentHeight = bounds.maxY - bounds.minY;
        const offsetX = (svgWidth - contentWidth) / 2 - bounds.minX;
        const offsetY = (svgHeight - contentHeight) / 2 - bounds.minY;

        setRenderedElements(
            <g transform={`translate(${offsetX}, ${offsetY})`}>
                {elements}
            </g>
        );
        // I've also corrected the variable names for slider width/height inside the calculation.
    }, [layout.puzzle_slots, slideGroups, svgWidth, svgHeight, slideWidth, slideHeight, gap]); // Rerun effect when layout or groups change

    return (
        <div className="form-section layout-visualizer">
            <h3>Layout Visualization</h3>
            <svg width={svgWidth} height={svgHeight} className="layout-svg">
                {renderedElements}
            </svg>
        </div>
    );
}

function AdvancedEditor() {

    const [availableGames, setAvailableGames] = useState([]);

    const [gameData, setGameData] = useState({
        gametitle: "",
        description: "",
        slide_groups: [
            {
                group_id: generateUUID(),
                group_name: "",
                slides: []
            },
            {
                group_id: generateUUID(),
                group_name: "",
                slides: []
            }
        ],
        puzzles: [{
            puzzle_id: generateUUID(),
            puzzletitle: "",
            instructions: "",
            matches: []
        }],
        layout: {
            puzzle_slots: []
        }
    });

    const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
    const [selectedPuzzleIndex, setSelectedPuzzleIndex] = useState(0);

    // State for the match editor's group selections
    const [sourceGroupId, setSourceGroupId] = useState('');
    const [targetGroupId, setTargetGroupId] = useState('');

    // State for direct JSON editing
    const [isJsonEditable, setIsJsonEditable] = useState(false);
    const jsonOutputRef = useRef(null);

    // This effect synchronizes the Match Editor's group selectors with the selected puzzle's explicit group IDs.
    useEffect(() => {

        const puzzle = gameData.puzzles[selectedPuzzleIndex];

        if (!puzzle) {

            setSourceGroupId('');
            setTargetGroupId('');

            return;
        }

        // Set the dropdowns to match the puzzle's stored group IDs.
        // Fallback to empty string if the properties don't exist (for older data).
        setSourceGroupId(puzzle.host_group_id || '');
        setTargetGroupId(puzzle.guest_group_id || '');

    }, [selectedPuzzleIndex, gameData.puzzles]);


    useEffect(() => {

        fetch('games/games.json')
            .then(response => response.json())
            .then(data => setAvailableGames(data))
            .catch(error => console.error("Error loading games.json:", error));
    }, []);

    const loadGameForEditing = (gameFile) => {

        fetch(gameFile)
            .then(response => response.json())
            .then(data => {
                // Only load if it has the new structure
                if (data.slide_groups) {

                    setGameData(data);
                    setSelectedGroupIndex(0);
                    setSelectedPuzzleIndex(0);
                    setSourceGroupId(data.slide_groups[0]?.group_id || '');
                    setTargetGroupId(data.slide_groups[1]?.group_id || '');

                } else {

                    alert("This game uses the old data structure. Please use the Simple Editor.");
                }
            })
            .catch(error => console.error(`Error loading game file ${gameFile}:`, error));
    };

    const handleMainInputChange = (e) => {

        const { name, value } = e.target;

        setGameData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const addPuzzle = () => {

        const newPuzzle = {
            puzzle_id: generateUUID(),
            puzzletitle: "",
            instructions: "",
            matches: [],
            host_group_id: "",
            guest_group_id: ""
        };

        setGameData(prev => ({ ...prev, puzzles: [...prev.puzzles, newPuzzle] }));
    };

    const updatePuzzle = (index, updatedPuzzle) => {

        setGameData(prev => {

            const newPuzzles = [...prev.puzzles];
            newPuzzles[index] = updatedPuzzle;

            return { ...prev, puzzles: newPuzzles };
        });
    };

    const removePuzzle = (index) => {

        if (index === selectedPuzzleIndex) {

            setSelectedPuzzleIndex(0);
        }

        setGameData(prev => ({ ...prev, puzzles: prev.puzzles.filter((_, i) => i !== index) }));
    };

    const addSlideGroup = () => {

        const newGroup = {
            group_id: generateUUID(),
            group_name: "",
            slides: []
        };

        setGameData(prev => ({ ...prev, slide_groups: [...prev.slide_groups, newGroup] }));
    };

    const updateSlideGroup = (index, updatedGroup) => {

        setGameData(prev => {
            const newGroups = [...prev.slide_groups];
            newGroups[index] = updatedGroup;
            return { ...prev, slide_groups: newGroups };
        });
    };

    const removeSlideGroup = (index) => {

        setGameData(prev => ({
            ...prev,
            slide_groups: prev.slide_groups.filter((_, i) => i !== index)
        }));
    };

    const addSlide = () => {

        const newSlide = {
            name: "",
            img: "",
            id: generateUUID(),
            isNew: true,
        };

        setGameData(prev => {

            const newGameData = { ...prev };
            // Remove 'isNew' flag from all other slides in all groups
            newGameData.slide_groups.forEach(group => {
                group.slides.forEach(slide => delete slide.isNew);
            });

            newGameData.slide_groups[selectedGroupIndex].slides.push(newSlide);

            return newGameData;
        });
    };

    const updateSlide = (slideIndex, updatedSlide) => {

        if (updatedSlide.isNew) {

            delete updatedSlide.isNew;
        }

        setGameData(prev => {

            const newGameData = { ...prev };
            newGameData.slide_groups[selectedGroupIndex].slides[slideIndex] = updatedSlide;
            return newGameData;
        });
    };

    const removeSlide = (slideIndex) => {

        setGameData(prev => {

            const newGameData = { ...prev };
            const groupSlides = newGameData.slide_groups[selectedGroupIndex].slides;
            newGameData.slide_groups[selectedGroupIndex].slides = groupSlides.filter((_, i) => i !== slideIndex);

            return newGameData;
        });
    };

    const updateLayout = (newLayout) => {

        setGameData(prev => ({
            ...prev,
            layout: newLayout
        }));
    };

    const handleMatchGroupChange = (groupType, groupId) => {

        const puzzle = gameData.puzzles[selectedPuzzleIndex];

        if (!puzzle) return;

        // Update the local state for the dropdowns immediately.
        if (groupType === 'source') {

            setSourceGroupId(groupId);

        } else {

            setTargetGroupId(groupId);
        }

        // Update the actual puzzle data.
        updatePuzzle(selectedPuzzleIndex, { ...puzzle, [groupType === 'source' ? 'host_group_id' : 'guest_group_id']: groupId });
    };
    const handleDownload = () => {
        // Create a clean version of the data without transient flags like 'isNew'
        const cleanGameData = JSON.parse(JSON.stringify(gameData));

        if (cleanGameData.slide_groups) {

            cleanGameData.slide_groups.forEach(group => {

                group.slides.forEach(slide => delete slide.isNew);
            });
        }

        const jsonString = JSON.stringify(cleanGameData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const filename = gameData.gametitle.toLowerCase().replace(/\s+/g, '_') || 'game';
        link.download = `${filename}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleNewGame = () => {

        const newInitialData = {
            gametitle: "",
            description: "",
            slide_groups: [
                {
                    group_id: generateUUID(),
                    group_name: "",
                    slides: []
                },
                {
                    group_id: generateUUID(),
                    group_name: "",
                    slides: []
                }
            ],
            puzzles: [{
                puzzle_id: generateUUID(),
                puzzletitle: "",
                instructions: "",
                matches: [],
                host_group_id: "",
                guest_group_id: ""
            }],
            layout: {
                puzzle_slots: []
            }
        };

        setGameData(newInitialData);
    };
    const toggleJsonEdit = () => {
        if (isJsonEditable) {
            // We are turning edit mode OFF. Parse the content.
            if (jsonOutputRef.current) {
                const newJsonString = jsonOutputRef.current.innerText;
                try {
                    const parsedData = JSON.parse(newJsonString);
                    // It's valid JSON, update the state
                    setGameData(parsedData);
                } catch (error) {
                    // It's invalid JSON
                    alert(`Error parsing JSON: ${error.message}\n\nYour changes were not saved. Please correct the JSON or disable editing to discard changes.`);
                    // Don't turn off edit mode, so the user can fix it.
                    return; // Prevent setIsJsonEditable(false) from running
                }
            }
        }
        setIsJsonEditable(prev => !prev);
    };

    // When isJsonEditable becomes true, focus the editor
    useEffect(() => {
        if (isJsonEditable && jsonOutputRef.current) jsonOutputRef.current.focus();
    }, [isJsonEditable]);

    const selectedGroup = gameData.slide_groups[selectedGroupIndex];
    const selectedPuzzle = gameData.puzzles[selectedPuzzleIndex];

    // Create virtual sliders for the MatchEditor based on selected group IDs
    const sourceGroupForMatch = gameData.slide_groups.find(g => g.group_id === sourceGroupId) || { id: '', slidertitle: 'Select Source', slides: [] };
    const targetGroupForMatch = gameData.slide_groups.find(g => g.group_id === targetGroupId) || { id: '', slidertitle: 'Select Target', slides: [] };

    const virtualSlidersForMatchEditor = [
        {
            id: sourceGroupForMatch.group_id,
            slidertitle: sourceGroupForMatch.group_name,
            slides: sourceGroupForMatch.slides
        },
        {
            id: targetGroupForMatch.group_id,
            slidertitle: targetGroupForMatch.group_name,
            slides: targetGroupForMatch.slides
        }
    ];

    return (
        <div className="editor-container">
            <div className="form-section games load-game">
                <h3>Load Game</h3>
                <ul className="game-list">
                    {availableGames.map((game, index) => (
                        <li key={index}>
                            <button onClick={() => loadGameForEditing(game.file)}>
                                {game.title} {game.isLegacy && '(Legacy)'}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="form-section new-game-section">
                <h3>Create New</h3>
                <button onClick={handleNewGame}>New Game</button>
            </div>

            <div className="form-section main-settings">
                <div className="form-group">
                    <label htmlFor="adv-gametitle">Game Title</label>
                    <input
                        type="text"
                        id="adv-gametitle"
                        name="gametitle"
                        value={gameData.gametitle}
                        onChange={handleMainInputChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="adv-gamedescription">Game Description</label>
                    <textarea
                        id="adv-gamedescription"
                        name="description"
                        value={gameData.description}
                        placeholder="Enter a short description for the game..."
                        onChange={handleMainInputChange}
                    />
                </div>
            </div>

            <div className="output-section">
                <div className="output-header">
                    <h3>Live JSON Output</h3>
                    <div>
                        <button onClick={toggleJsonEdit} className={`icon-button ${isJsonEditable ? 'active' : ''}`} title={isJsonEditable ? "Save and Exit Edit Mode" : "Edit JSON"}>
                            <img src="style/edit.svg" alt="Edit" />
                        </button>
                        <button onClick={handleDownload} className="icon-button" title="Download JSON">
                            <img src="style/save.svg" alt="Download" />
                        </button>
                    </div>
                </div>
                <div className="json-output-container">
                    <pre className="json-output" ref={jsonOutputRef} contentEditable={isJsonEditable} suppressContentEditableWarning={true}
                        onBlur={isJsonEditable ? null : undefined}>
                        {JSON.stringify(gameData, null, 2)}
                    </pre>
                </div>
            </div>

            <div className="form-section slide-groups">
                <h3>Slide Groups</h3>
                {gameData.slide_groups.map((group, index) => (
                    <SlideGroupItem key={index} group={group} index={index} onUpdate={updateSlideGroup} onRemove={removeSlideGroup} onSelect={setSelectedGroupIndex} isSelected={index === selectedGroupIndex} />
                ))}
                <button onClick={addSlideGroup}>Add Slide Group</button>
            </div>
            
            <AdvancedSlideList
                slides={selectedGroup ? selectedGroup.slides : []}
                onAdd={addSlide}
                onUpdate={updateSlide}
                onRemove={removeSlide}
            />

            <PuzzleList
                puzzles={gameData.puzzles} // This component has its own grid-column style
                onAdd={addPuzzle}
                onUpdate={updatePuzzle}
                onRemove={removePuzzle}
                onSelect={setSelectedPuzzleIndex}
                selectedIndex={selectedPuzzleIndex}
            />

            <div className="form-section matches">
                <h3>Match Editor</h3>
                <div className="match-group-selectors">
                    <select value={sourceGroupId} onChange={e => handleMatchGroupChange('source', e.target.value)}>
                        {gameData.slide_groups.map(g => (<option key={`source-${g.group_id}`} value={g.group_id}>{g.group_name}</option>))}
                    </select>
                    <select value={targetGroupId} onChange={e => handleMatchGroupChange('guest', e.target.value)}>
                        {gameData.slide_groups.map(g => (<option key={`target-${g.group_id}`} value={g.group_id}>{g.group_name}</option>))}
                    </select>
                </div>
                <MatchEditor puzzle={selectedPuzzle} onUpdate={(updated) => updatePuzzle(selectedPuzzleIndex, updated)} sliders={virtualSlidersForMatchEditor} />
            </div>

            <div className="form-section layout-section">
                <LayoutEditor layout={gameData.layout} puzzles={gameData.puzzles} slideGroups={gameData.slide_groups} onUpdate={updateLayout} /> 
                <LayoutVisualizer layout={gameData.layout} slideGroups={gameData.slide_groups} />
            </div>
        </div>
    );
}

function Editor() {

    return (
        <div>
            <h1>Match-locker game Editor</h1>
            <div className="editor-tabs">
                <button className="tab-button active">Editor</button>
            </div>
            <div id="advanced-editor-content" className="tab-content active">
                <AdvancedEditor />
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Editor />);
