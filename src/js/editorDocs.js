const EditorDocs = () => {
    return (
        <div className="form-section docs-section" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            <nav style={{ width: '200px', flexShrink: 0, position: 'sticky', top: '20px' }}>
                <h4 style={{ marginTop: 0 }}>Contents</h4>
                <ul className="nav-list docs-toc">
                    <li><a href="#intro">Match-locker</a></li>
                    <li><a href="#editor">The Editor</a></li>
                    <li><a href="#process">The Process</a></li>
                    <li><a href="#games">Games</a></li>
                    <li><a href="#puzzles">Puzzles</a></li>
                    <li><a href="#creating">Creating a Game</a></li>
                    <li><a href="#navigation">Navigation</a></li>
                    <li><a href="#save">Edit &amp; Save</a></li>
                </ul>
            </nav>
            <div style={{ flexGrow: 1, borderLeft: '1px solid #eee', paddingLeft: '20px', maxWidth: '80ch' }}>
                <h3 id="intro" style={{ marginTop: 0 }}>Match-locker</h3>
                <p>Match-locker is a game where you swipe slides horizontally and vertically and then tap to match slides until you complete the puzzles. One or more puzzles make a game.</p>
                
                <h3>Designing a game with the puzzles</h3>
                <p>A game can consist of one puzzle with two swipers. The simplest puzzle is a series of slides that match another series of slides. No intended connection between the matches except maybe the topic eg. food &amp; country.</p>
                <p>But the Editor and game provide a way to create several puzzles in one game, like: match the scientist with the equation and then match the equation with the year it was published. We could go deeper and have four levels or even more!</p>
                <p>For a puzzle to work we need to consider that the slides overlap. A horizontal swiper and vertical swiper are overlayed and form a puzzle. It seems too obvious to mention but take care the only the bottom slider can be full screen.<br/>
                It is possible to change the order of the swipers in the Layout with puzzle slots</p>

                <h3 id="editor">The Editor</h3>
                <p>The editor provides a visual way to compile the elements of puzzles and games into a game data file &lt;game&gt;.json.</p>

                
                <h4 id="process">The Process</h4>
                <ul>
                    <li>Game definition</li>
                    <li>Slides in slide groups</li>
                    <li>Compose a puzzle from slide groups
                        <ul>
                            <li>Set the type</li>
                            <li>Set the matches between slides</li>
                        </ul>
                    </li>
                    <li>Set the visual layout
                        <ul>
                            <li>Define the puzzle slots</li>
                        </ul>
                    </li>
                    <li>Edit &amp; Save</li>
                </ul>
                <p>The Editor is organised to define the Game info and then work from the bottom up. You define a group of slides and add the slides. From the groups of slides, you can compose a puzzle. Composing a puzzle means providing the description, the type of puzzle, how it is evaluated and more. Now you select which two slide groups comprise a puzzle. Then you need to specify what the player needs to solve! This means connecting a slide with another slide. That is what the Match editor is for! Select a slide and it gets highlighted, select the next slide and it gets connected to the first slide. Depending on the game type, you can connect several slides to one slide.</p>
                <p>Now you have a puzzle you can set what the visual layout is that will be presented to the player. Puzzle slots is where that happens. By defining a Puzzle slot you set where the two swipers of a puzzle overlap. The Layout Visualization displays the results of the puzzle slot settings.</p>
                
                <h4 id="games">Games</h4>
                <p>A game is one or more puzzles.</p>

                <h4 id="puzzles">Puzzles</h4>
                <p>A puzzle consists of two slide groups where the puzzle defines how the puzzle is solved.</p>
                <p>There are several puzzle types: set, chain, ring and star which can have an evaluation rule of unordered or ordered. That means you need to make the matches in a specifc order or you can match the slides in any order.</p>
                <p>The meaning of the puzzle types:</p>
                
                <h5>Set</h5>
                <p>A set of single matches of two slides.</p>

                <h5>Chain</h5>
                <p>One slide matched to a second slide. The second slide matched to a third slide and so on.</p>

                <h5>Ring</h5>
                <p>One slide matched to a second slide. The second slide matched to a third slide and so on. At some point the last slide is matched to the first slide.</p>

                <h5>Star</h5>
                <p>One slide matched to several slides.</p>

                <h4 id="creating">Creating a Game</h4>
                <p>We'll go through a typical game creation.</p>

                <h5>Game</h5>
                <p>The top level is the game, it describes what the game is about.</p>

                <h5>Slide group and Slides</h5>
                <p>A basic puzzle comprises of two groups of slides. So you make a slide group and add slides. For the puzzle you need to make a second group and add the slides. And because we want to explain a more complex game, lets add a third slide group with several slides.</p>

                <h5>Puzzle</h5>
                <p>We then compose a puzzle, set the title and description of the puzzle which are shown in the @info screen, we set the type of puzzle and how to match the slides: can we match the slides in any order or do we need match the slides in a specific order.</p>
                <p>It's important to notice that we can make a puzzle with the first slide group and the second slide group, and then make a second puzzle with the second slide group and the third slide group.</p>

                <h5>Matches</h5>
                <p>Next, with a puzzle defined, in the Match Editor, we can select which two slide groups will need to be matched and define what the matches are. The matches are defined by clicking the first slide of the match to activate it and then clicking the second slide. If the evaluation rule is set to ordered, the order of setting the matches is important. You will see the order marked with the number label.</p>

                <h5>Layout with puzzle slots</h5>
                <p>Until now we have defined all the elements and how they interact. Now that we have puzzles we can define the layout of the puzzles.</p>

                <h6>Puzzle slot</h6>
                <p>A puzzle slot is a place on two swipers where their slots overlap and where the player can match the slides.</p>
                <p>Lets call a slide group in a puzzle in the layout a Swiper. A swiper has the slides of a slide group. Imagine for each slide in the slide group, in the swiper, there is a slot. Slot 1, slot 2, slot 3 ... When the player swipes through the slides, the position of the slides changes in the slots but the slots stay the same position. A puzzle slot is a place on two swipers where their slots overlap and where the player can match the slides.</p>
                <p>With the indices you can set the position of where the first swiper overlaps with the second swiper.</p>
                <p>To understand the implications of the index and the guest align index you can play with the numbers and see the result on the Layout Visualisation.</p>

                <h4 id="navigation">Navigation to Puzzles</h4>
                <p>The player can swipe the slides in the swiper. When they have matched all the slides, they can navigate the slots on the swipers. The default setting is that the player can navigate puzzles on the @info screen. In the settings screen the player can set the visibility of the navigation on the game screen itself for convenience.</p>
                <p>Swipe the slides happens by dragging and flinging. The slides in the swiper animate to a destination and then snap to the center of the viewport.</p>
                <p>Navigating the slots happens with the navigation buttons. Up and down left and right when possible!! When the player navigates to a slot on a swiper that is not a puzzle slot, dependent on the direction of the swiper you can only navigate vertical OR horizontal. If the Swipers overlap making a puzzleslot the player can navigate both horizontally AND vertically. The swiping and navigating are SEPERATE ... BUT ... when we navigate the slots the swiper DOES show the movement of the slides to illustrate the movement over the slots.</p>

                <h3 id="save">Save a Game</h3>
                
                <h4 id="save-section">Save</h4>
                <p>The app looks for a games.json to fill the list of games. So we need to save the data file that you have created in the editor. On the Live Json output panel there is a save button. That will open a Save as dialog where you can give the file a name and save it to a folder.</p>

                <h4 id="edit-section">Edit</h4>
                <p>Notice that there is an edit button. This will allow you to actually edit the data in the json file. It also makes it possible to import / paste game data into the Editor. But be aware that there is no validation of the syntax or the data format. So you can edit the file ... but if your changes are not correct, the Editor will not help you.</p>
            </div>
        </div>
    );
}

window.EditorDocs = EditorDocs;
