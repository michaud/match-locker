const { useState, useEffect, useRef } = React;

const gamesFilePath ='games/games.json';

function generateUUID() {
    // A simple and effective way to generate a UUID in modern browsers
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

function SlideItem({ slide, index, onUpdate, onRemove, isNew, onMove, isFirst, isLast }) {

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
                    <label htmlFor={`slide-name-${index}`}>Slide Name</label> 
                    <div className="item-controls" style={{ display: 'flex', gap: '5px' }}>
                        {onMove && (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); onMove(index, -1); }} disabled={isFirst} title="Move Up">▲</button>
                                <button onClick={(e) => { e.stopPropagation(); onMove(index, 1); }} disabled={isLast} title="Move Down">▼</button>
                            </>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); onRemove(index); }} className="remove-button" title="Remove Slide"><img src="style/trash.svg" alt="Remove" /></button>
                    </div>
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

        const { name, value, type } = e.target;
        const newValue = type === 'number' ? (value === '' ? 0 : parseInt(value, 10)) : value;
        onUpdate(index, { ...puzzle, [name]: newValue });
    };

    const matchCount = (puzzle.matches || []).length;

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
            <div className="form-group">
                <label htmlFor={`puzzle-subset-count-${index}`}>Subset Count (0 = All)</label>
                <input
                    type="number"
                    id={`puzzle-subset-count-${index}`}
                    name="subset_count"
                    value={puzzle.subset_count || 0}
                    onChange={handleInputChange}
                    min="0"
                    disabled={(puzzle.type || 'set') !== 'set'}
                />
                {puzzle.subset_count > matchCount && puzzle.subset_count > 0 && (
                    <p className="help-text" style={{ color: 'orange' }}>
                        Warning: Count exceeds available matches ({matchCount}). The number will be adjusted to the match count.
                    </p>
                )}
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
            <div className="form-group" style={{ marginTop: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={group.scramble !== false}
                        onChange={(e) => onUpdate(index, { ...group, scramble: e.target.checked })}
                    />
                    Scramble Slides (Default)
                </label>
            </div>
            {/* Placeholder for slides within this group */}
            <div className="nested-list-placeholder">
                <p>{group.slides.length} slide(s) in this group.</p>
            </div>
            <small className="item-id">{group.group_id}</small>
        </div>
    );
}

function AdvancedSlideList({ slides, onAdd, onUpdate, onRemove, onMove }) {

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
                        onMove={onMove}
                        isFirst={index === 0}
                        isLast={index === slides.length - 1}
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

function SliderLayerManager({ sliders, slideGroups, onUpdate }) {
    if (!sliders || sliders.length === 0) {
        return (
            <div className="slider-layer-manager">
                <h4>Slider Layer Order</h4>
                <p className="help-text"></p>
            </div>
        );
    }

    const moveSlider = (index, direction) => {
        const newSliders = [...sliders];
        const newIndex = index + direction;

        if (newIndex < 0 || newIndex >= newSliders.length) {
            return; // Out of bounds
        }

        // Swap elements
        [newSliders[index], newSliders[newIndex]] = [newSliders[newIndex], newSliders[index]];
        
        onUpdate(newSliders);
    };

    const getGroupName = (groupId) => {
        const group = slideGroups.find(g => g.group_id === groupId);
        return group ? group.group_name : `(Unknown: ${groupId})`;
    };

    return (
        <div className="slider-layer-manager">
            <h4>Slider Layer Order (Bottom to Top)</h4>
            <ol className="reorder-list">
                {sliders.map((slider, index) => (
                    <li key={slider.id || index}>
                        <div className="reorder-item">
                            <span>{getGroupName(slider.populates_from_group)}</span>
                            <div className="reorder-controls">
                                <button onClick={() => moveSlider(index, -1)} disabled={index === 0} title="Move Up">▲</button>
                                <button onClick={() => moveSlider(index, 1)} disabled={index === sliders.length - 1} title="Move Down">▼</button>
                            </div>
                        </div>
                    </li>
                ))}
            </ol>
            <p className="help-text">The last slider in this list will appear on top of all others in the game.</p>
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

        // Only update the slots. The useEffect will handle syncing the main sliders array.
        onUpdate({ ...layout, puzzle_slots: newSlots });
    };

    // Effect to synchronize layout.sliders with the groups defined in puzzle_slots
    useEffect(() => {
        const slots = layout?.puzzle_slots || [];
        const currentSliders = layout?.sliders || [];
        
        // 1. Get all unique group IDs and their directions from puzzle slots
        const groupsInSlots = new Map();
        slots.forEach(slot => {
            if (slot.host_group_id) {
                groupsInSlots.set(slot.host_group_id, slot.host_direction || 'horizontal');
            }
            if (slot.guest_group_id) {
                groupsInSlots.set(slot.guest_group_id, slot.guest_direction || 'vertical');
            }
        });

        let newSliders = [...currentSliders];
        let needsUpdate = false;

        // 2. Remove sliders that are no longer in any slot, preserving order
        const filteredSliders = newSliders.filter(slider => groupsInSlots.has(slider.populates_from_group));
        if (filteredSliders.length !== newSliders.length) {
            newSliders = filteredSliders;
            needsUpdate = true;
        }

        // 3. Add new groups from slots that are not in the sliders list yet
        groupsInSlots.forEach((direction, groupId) => {
            if (!newSliders.some(s => s.populates_from_group === groupId)) {
                newSliders.push({
                    id: groupId, // The slider ID should match the group ID for consistency
                    populates_from_group: groupId,
                    direction: direction
                });
                needsUpdate = true;
            }
        });
        
        // 4. Ensure all slider directions are up-to-date with the slots
        const finalSliders = newSliders.map(slider => {
            const expectedDirection = groupsInSlots.get(slider.populates_from_group);
            if (expectedDirection && slider.direction !== expectedDirection) {
                needsUpdate = true;
                return { ...slider, direction: expectedDirection };
            }
            return slider;
        });

        if (needsUpdate) {
            onUpdate({ ...layout, sliders: finalSliders });
        }

    }, [layout?.puzzle_slots]);

    // Handler for the layer manager to update the order
    const handleSliderOrderChange = (reorderedSliders) => {
        onUpdate({ ...layout, sliders: reorderedSliders });
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
            <SliderLayerManager 
                sliders={layout?.sliders}
                slideGroups={slideGroups}
                onUpdate={handleSliderOrderChange}
            />
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
        const sliders = layout?.sliders || []; // Get the ordered sliders

        if (puzzleSlots.length === 0 || sliders.length === 0) {

            setRenderedElements(<p>Define puzzle slots to see the visualization.</p>);

            return;
        }

        // --- 1. Position Calculation Phase ---
        const slidePositions = new Map();
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
        
        const visitedPositions = new Set();
        const calculateAllPositionsRecursive = (groupId, currentX, currentY) => {
            if (visitedPositions.has(groupId)) return;
            visitedPositions.add(groupId);

            const groupInfo = allGroupsInLayout.get(groupId);
            const slideGroup = slideGroups.find(g => g.group_id === groupId);
            if (!slideGroup) return;

            const isHorizontal = groupInfo.direction === 'horizontal';
            const guests = puzzleSlots.filter(slot => slot.host_group_id === groupId);

            slideGroup.slides.forEach((slide, index) => {
                const x = isHorizontal ? currentX + index * (slideWidth + gap) : currentX;
                const y = isHorizontal ? currentY : currentY + index * (slideHeight + gap);
                // Use slide ID for a stable key
                slidePositions.set(`${groupId}-${slide.id}`, { x, y });
            });

            guests.forEach(slot => {
                const atIndex = slot.at_index || 0;
                const guestAlignIndex = slot.guest_align_index || 0;
                
                const hostSlideGroup = slideGroups.find(g => g.group_id === slot.host_group_id);
                const hostSlide = hostSlideGroup?.slides[atIndex];
                if (!hostSlide) return;

                const hostPos = slidePositions.get(`${slot.host_group_id}-${hostSlide.id}`);
                if (!hostPos) return;

                let nextX, nextY;
                if (isHorizontal) {
                    nextX = hostPos.x;
                    nextY = hostPos.y - (guestAlignIndex * (slideHeight + gap));
                } else {
                    nextY = hostPos.y;
                    nextX = hostPos.x - (guestAlignIndex * (slideWidth + gap));
                }
                calculateAllPositionsRecursive(slot.guest_group_id, nextX, nextY);
            });
        };

        if (rootGroups.length === 0 && puzzleSlots.length > 0) {
            // Handle case with no root (e.g., a single ring)
            calculateAllPositionsRecursive(puzzleSlots[0].host_group_id, 0, 0);

        } else {

            rootGroups.forEach(root => calculateAllPositionsRecursive(root.id, 0, 0));
        }

        // --- 2. Rendering Phase (respecting slider order) ---
        const elements = [];
        const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

        sliders.forEach(sliderConfig => {
            const groupId = sliderConfig.populates_from_group;
            const slideGroup = slideGroups.find(g => g.group_id === groupId);
            if (!slideGroup) return;

            const isHorizontal = sliderConfig.direction === 'horizontal';

            slideGroup.slides.forEach(slide => {
                const pos = slidePositions.get(`${groupId}-${slide.id}`);
                if (!pos) return;

                bounds.minX = Math.min(bounds.minX, pos.x);
                bounds.minY = Math.min(bounds.minY, pos.y);
                bounds.maxX = Math.max(bounds.maxX, pos.x + slideWidth);
                bounds.maxY = Math.max(bounds.maxY, pos.y + slideHeight);

                elements.push(
                    <g key={`slide-${groupId}-${slide.id}`}>
                        <rect x={pos.x} y={pos.y} width={slideWidth} height={slideHeight} className={`slide-rect ${isHorizontal ? 'horizontal-slide' : 'vertical-slide'}`} />
                        <text x={pos.x + slideWidth / 2} y={isHorizontal ? pos.y + slideHeight / 2 + 5 : pos.y + slideHeight - 5} textAnchor="middle" className="slide-text">
                            {slide.name.substring(0, 10)}
                        </text>
                    </g>
                );
            });
        });

        // --- 3. Slot Highlighting (drawn on top of all slides) ---
        puzzleSlots.forEach(slot => {
            const atIndex = slot.at_index || 0;
            const hostSlideGroup = slideGroups.find(g => g.group_id === slot.host_group_id);
            const hostSlide = hostSlideGroup?.slides[atIndex];
            if (!hostSlide) return;

            const hostPos = slidePositions.get(`${slot.host_group_id}-${hostSlide.id}`);
            if (!hostPos) return;

            elements.push(
                <rect key={slot.slot_id || `slot-${slot.host_group_id}-${slot.guest_group_id}`} x={hostPos.x} y={hostPos.y} width={slideWidth} height={slideHeight} className="highlight-slot" />
            );
        });

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
    }, [layout, slideGroups, svgWidth, svgHeight, slideWidth, slideHeight, gap]); // Rerun effect when layout or groups change

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

        fetch(gamesFilePath)
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

    const moveSlide = (slideIndex, direction) => {
        setGameData(prev => {
            const newGameData = { ...prev };
            const group = newGameData.slide_groups[selectedGroupIndex];
            const slides = [...group.slides];
            const newIndex = slideIndex + direction;
            
            if (newIndex >= 0 && newIndex < slides.length) {
                [slides[slideIndex], slides[newIndex]] = [slides[newIndex], slides[slideIndex]];
                group.slides = slides;
            }
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
                onMove={moveSlide}
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
