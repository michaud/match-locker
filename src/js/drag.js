/**
 * Creates a handler for pointer drag interactions on the game screen.
 * @param {HTMLElement} screen - The main screen element.
 * @param {function} getSwipers - A function that returns the current host and guest swipers.
 * @param {function} onTapCallback - A callback to fire when a tap/click occurs.
 * @param {function} onDragStartCallback - A callback to fire when a drag officially starts, receiving the dragged and other swiper.
 * @returns {object} An object with an `attach` method to enable the handler.
 */
export function createDragHandler(screen, getSwipers, onTapCallback, onDragStartCallback) {

    const state = {
        isDown: false,
        direction: null,
        startX: 0,
        startY: 0,
        isDragStarted: false,
        dragThreshold: 10
    };

    const handlePointerMove = (event) => {

        if (!state.isDown) return;

        if (!state.direction) {

            const deltaX = Math.abs(event.clientX - state.startX);
            const deltaY = Math.abs(event.clientY - state.startY);

            if (deltaX > state.dragThreshold || deltaY > state.dragThreshold) {

                state.direction = (deltaX > deltaY) ? 'horizontal' : 'vertical';
            }
        }

        const { hostSwiper, guestSwiper } = getSwipers();

        if (!hostSwiper && !guestSwiper) return; // No swipers to drag

        const dragSwiper = (state.direction === hostSwiper.getDirection()) ? hostSwiper :
            (guestSwiper && state.direction === guestSwiper.getDirection()) ? guestSwiper : null;

        let otherSwiper = null;

        if (dragSwiper) {

            if (dragSwiper === hostSwiper && guestSwiper) {

                otherSwiper = guestSwiper;

            } else if (dragSwiper === guestSwiper && hostSwiper) {

                otherSwiper = hostSwiper;
            }
        }



        if (dragSwiper) {

            if (!state.isDragStarted) {

                dragSwiper.startDrag(state.direction === 'horizontal' ? state.startX : state.startY);
                state.isDragStarted = true;

                if (onDragStartCallback) {

                    onDragStartCallback(dragSwiper, otherSwiper); // prettier-ignore
                }
            }

            dragSwiper.drag(state.direction === 'horizontal' ? event.clientX : event.clientY);
        }
    };

    const handlePointerUp = () => {

        state.isDown = false;
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);

        if (state.direction === null && onTapCallback) { // Only call onTap if no drag occurred

            onTapCallback();
            // Reset cursor and class on tap, since no snap will occur.
            screen.style.cursor = 'grab';
            screen.classList.remove('is-dragging');

        } else {

            const { hostSwiper, guestSwiper } = getSwipers();

            if (hostSwiper && state.direction === hostSwiper.getDirection()) hostSwiper.endDrag();
            else if (guestSwiper && state.direction === guestSwiper.getDirection()) guestSwiper.endDrag();
        }

        // Reset direction for the next interaction, regardless of whether it was a tap or drag.
        state.direction = null;
    };

    const handlePointerDown = (event) => {

        if (event.button !== 0) return;

        Object.assign(state, { 
            isDown: true,
            direction: null,
            startX: event.clientX,
            startY: event.clientY,
            isDragStarted: false 
        });

        screen.style.cursor = 'grabbing';
        screen.classList.add('is-dragging'); // Add dragging class on pointer down
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    };

    return {
        attach: () => screen.addEventListener('pointerdown', handlePointerDown),
        detach: () => screen.removeEventListener('pointerdown', handlePointerDown)
    };
}
