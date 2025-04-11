let currentCanvas = 0; // To store the currently active canvas
let context = null; // To store the context of the currently active canvas
let strokeColor = '#FFF';
let currentDrawer = null; // The user ID of the current drawer
let heartbeatInterval = 0;
const userID = Math.random().toString(36).substring(7); // Generate a random user ID for this session


const toolbar = document.getElementById('toolbar');
const lineWidthInput = document.getElementById('lineWidth');
const strokeColorInput = document.getElementById('stroke');
const mapSelectionInput = document.getElementById('mapSelection');

const colorMap = {
  'red-button': '#FF0000', // Red
  'orange-button': '#FFA500', // Orange
  'yellow-button': '#FFFF00', // Yellow
  'green-button': '#008000', // Green
  'blue-button': '#0000FF', // Blue
  'indigo-button': 'purple', 
  'violet-button': '#EE82EE', // Violet
};


let lineWidth = 3;	
lineWidthInput.value = 3;

let isErasing = false;

let index = -1;

mapSelectionInput.selectedIndex = 0;

// Establish WebSocket connection to the server
const socket = new WebSocket('wss://whispering-savannah-93250-15990bfcecad.herokuapp.com');

socket.onopen = () => {
    console.log('Connected to WebSocket server');
	startHeartbeat();
};

socket.onclose = (event) => {
        console.warn(`WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
        
        // Stop heartbeat when connection closes
        stopHeartbeat();
    };
	
function changeStrokeColor(event) {
  const buttonId = event.target.id;
  if (colorMap[buttonId]) {
    strokeColor = colorMap[buttonId];
	context.strokeStyle = strokeColor;
    console.log('Selected stroke color:', strokeColor); // Debug: Check the color
  }
  isErasing = false;
  console.log("Eraser deactivated");
}

document.querySelectorAll('.color-btn').forEach(button => {
  button.addEventListener('click', changeStrokeColor);
});



function startHeartbeat() {
    stopHeartbeat(); // Ensure no duplicate intervals
    heartbeatInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
			console.log('Client: ping');
        }
    }, 15000); // Ping every 15 seconds
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

function captureCanvasState() {
    if (!context) return;
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
}


// Handle incoming WebSocket messages
socket.onmessage = (event) => {
    try {
        const message = JSON.parse(event.data);
        console.log('Received message of type:', message.type, message);

        switch (message.type) {
            case 'syncState':
                const { currentTabIndex, imageUrls, drawingData } = message.state;
                
                updateImagesOnCanvas(imageUrls);
                switchTab(currentTabIndex);
                
                drawingData.forEach(({ x, y, lineWidth, color }) => {
                    drawOnCanvasFromServer(x, y, lineWidth, color);
                });
                break;

            case 'beginStroke':
                if (context && typeof context.beginPath === 'function') {
                    context.beginPath();
                } else {
                    console.warn('Context is not initialized when beginStroke was received.');
                }
                break;
				
            case 'startDrawing':
                currentDrawer = message.drawer;
                break;

            case 'stopDrawing':
                currentDrawer = null;
                break;

            case 'draw':
                drawOnCanvasFromServer(message.x, message.y, message.lineWidth, message.color);
                break;

            case 'clear':
                clearCanvas();
                break;

            case 'imageChange':
                updateImagesOnCanvas(message.imageUrls);
                break;

            case 'switchTabs':
                if (Number.isInteger(message.index)) {
                    switchTab(message.index, true);
                } else {
                    console.error('Received invalid switchTabs index:', message.index);
                }
                break;

            case 'pong':
                console.log('Server: pong');
                break;

            default:
                console.log('Unknown message type:', message.type);
                break;
        }
    } catch (error) {
        console.error('Error parsing message:', error);
    }
};


// Function to update images on the canvas for all clients
function updateImagesOnCanvas(imageUrls) {
    const tabContentContainer = document.getElementById('tab-content-container');
    tabContentContainer.innerHTML = ''; // Clear current content
    const tabsContainer = document.getElementById('tabs');
    tabsContainer.innerHTML = ''; // Clear current tabs

    // Load new images into tabs
    imageUrls.forEach((url, index) => {
        // Create the tab
        const tab = document.createElement('div');
        tab.classList.add('tab');
        tab.textContent = `Floor ${index + 1}`; // Adjust floor number
        tab.dataset.index = index;
        tab.addEventListener('click', () => switchTab(index));
        tab.classList.add('btn');
        tabsContainer.appendChild(tab);

        // Create the tab content
        const tabContent = document.createElement('div');
        tabContent.classList.add('tab-content');
        if (index === 0) tabContent.classList.add('active'); // Set first tab as active

        const canvas = document.createElement('canvas');
        tabContent.appendChild(canvas);
		
		const originalImage = document.createElement('img');
		originalImage.src = url;
		originalImage.style.display = 'none';
		
		tabContent.appendChild(originalImage);

        const image = new Image();
        image.src = url;
        image.onload = () => {
			image.crossOrigin = "anonymous";
            canvas.width = image.width;
            canvas.height = image.height;

            const canvasContext = canvas.getContext('2d');
            canvasContext.drawImage(image, 0, 0);

            // After the image is loaded, attach drawing events
            attachDrawingEvents(canvas);
        };

        tabContentContainer.appendChild(tabContent);
    });
    switchTab(0);
}

// Function to handle incoming drawing data from other users
function drawOnCanvasFromServer(x, y, lineWidth, color) {
    if (context) {
        context.lineWidth = lineWidth;
        context.strokeStyle = color;
        context.lineTo(x, y);
        context.stroke();
    }
}

// Function to clear the canvas (on all clients)
function clearCanvas() {
    const activeTabContent = document.querySelector('.tab-content.active');
    if (activeTabContent) {
		// clear current image and drawing
        const canvas = activeTabContent.querySelector('canvas');
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
		
		// Draw new image on the canvas
			const imageUrl = activeTabContent.querySelector('img');
			
			console.log('imageUrl = ' + imageUrl.src);
			
			const image = new Image();
			image.src = imageUrl.src;
			image.onload = () => {
				image.crossOrigin = "anonymous";
				canvas.width = image.width;
				canvas.height = image.height;

				const context = canvas.getContext('2d');
				context.drawImage(image, 0, 0);

				// Attach drawing events to new canvas
				attachDrawingEvents(canvas);
			};	
    }
}

// Toolbar click event listener to clear the canvas
toolbar.addEventListener('click', e => {
    if (e.target.id === 'clear') {
        // Find the active tab content container
        const activeTabContent = document.querySelector('.tab-content.active');
        
        // If there's an active tab content
        if (activeTabContent) {
            // Find the canvas element within the active tab content
            const canvas = activeTabContent.querySelector('canvas');
            context = canvas.getContext('2d');
            
            // Clear the canvas
            context.clearRect(0, 0, canvas.width, canvas.height);

			// Draw new image on the canvas
			const imageUrl = activeTabContent.querySelector('img');
			
			console.log('imageUrl = ' + imageUrl.src);
			
			const image = new Image();
			image.crossOrigin = "anonymous";
			image.src = imageUrl.src;
			image.onload = () => {
				canvas.width = image.width;
				canvas.height = image.height;

				const context = canvas.getContext('2d');
				context.drawImage(image, 0, 0);

				// Attach drawing events to new canvas
				attachDrawingEvents(canvas);
			};

            // Send clear message to the server
            socket.send(JSON.stringify({ type: 'clear' }));
        }
    }
});

// Toolbar change event listener for stroke color and line width
toolbar.addEventListener('change', e => {
    if (e.target.id === 'lineWidth') {
        lineWidth = e.target.value;
    }
});


// Handle map selection and broadcast image change to the server
document.getElementById('mapSelection').addEventListener('change', (e) => {
    const selectedOption = e.target.value;
    const tabsContainer = document.getElementById('tabs');
    const tabContentContainer = document.getElementById('tab-content-container');

    // Clear previous tabs and content
    tabsContainer.innerHTML = '';
    tabContentContainer.innerHTML = '';

    let imageUrls = [];

    if (selectedOption === 'Bank') {
        imageUrls = [
            'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/1DQ8HzVXAIpl5Flv1BNURw/c312cb87861b6c936510bc751ba9683b/r6-maps-bank-blueprint-3.jpg',
            'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/6ZcnTtEXcYt8CrMsjbCvSu/df6694e263225814bb6ac8a0787d90d5/r6-maps-bank-blueprint-1.jpg',
            'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/6ITkJP9lxHjVKzS9Ubcwtv/5e3948920858f8a624cffa56fc7514df/r6-maps-bank-blueprint-2.jpg'
        ];
    } else if (selectedOption === 'Border') {
        imageUrls = [
            'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/4nl4T7y1mBfwrti5e8Jq9Q/78fc6dbba89cdcc5a10a8e90889e870b/r6-maps-border-blueprint-1.jpg',
            'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/1lG2AxuPadRvfN8Vjx7jGV/200afc5ce945628b744437a20969b1c5/r6-maps-border-blueprint-2.jpg'
        ];
    } else if (selectedOption === 'Chalet') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/55eH3asFElZrkQdK1WmPyY/583fdef645e3bf497b0e95ea25e50bb0/r6-maps-chalet-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/1qLSejhKPmyxbRyzDvSjMF/d4b547dba92db0a7b9dbf9e533159db6/r6-maps-chalet-blueprint-2.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/6Zrwl833U738T3GCsWyH5O/b795a4fa369d5ce5ee9a92064c5faec3/r6-maps-chalet-blueprint-3.jpg'
		];
	} else if (selectedOption === 'CloseQuarter') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/71EK350DYjhwYhMbpj3A8k/cd0a6ae7a53954f01523e1b2066a66d7/r6-maps-closequarter-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/7fETrde3epN5cARWgtPPJv/a4d103caec02807dddb806341e982c42/r6-maps-closequarter-blueprint-2.jpg'
		];
	} else if (selectedOption === 'Clubhouse') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/6Zs2KBoWjSdaC3qssqwB9N/33907dda5e0363659477296c0e9756c5/r6-maps-clubhouse-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/3taneZwe0lPRHGvXcJZb6Q/a35fd0b00699bbcc7a88bd2c08db96b6/r6-maps-clubhouse-blueprint-2.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/4StUcsi07j6h4DPrmgF5rC/bb99e697439b647bb4fd192b29bb588c/r6-maps-clubhouse-blueprint-3.jpg'
		];
	} else if (selectedOption === 'Coastline') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/4b0lpXOb5Hv6kgJ2BvrjP9/59b1ccd49d36b8b38621d39d8f9479f9/r6-maps-coastline-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/5juDHwzsSzib8ljx1IzhUa/47430644b7f65c72df9f26a340bead84/r6-maps-coastline-blueprint-2.jpg'
		];
	} else if (selectedOption === 'Consulate') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/14Ww7AoFdDGhcjgWpLTMdV/77bc68f24869fd75b49a715b67925488/r6-maps-consulate-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/v0KtqRwgoNXSvGxjn0MVR/ec1200c055944ceba822a118d3611197/r6-maps-consulate-blueprint-2.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/5Tu3Q2DYvBFyqszsrTwawU/cd611afdefa6713e3ec7237fabb58299/r6-maps-consulate-blueprint-3.jpg'
		
		];
	} else if (selectedOption === 'EmeraldPlains') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/6IPo90GFnnPbW4ri4arLND/066cafe4e7a2d36c8271570cd6047c50/r6-maps-emeraldplains-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/7uZShb7RUrKPxmdhs9nwFq/e84d6ba647344e5b9a86c09e1c4bb289/r6-maps-emeraldplains-blueprint-2.jpg'
		];
	} else if (selectedOption === 'Favela') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/26Ag3XCDr8JZ6dtc2QAK20/4c7e8950e9a62fd2ed36cf3fc0cbf381/r6-maps-favela-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/3pDlb3ITRjbF8bc8yUd5B2/1503673246145389293917c07137809a/r6-maps-favela-blueprint-2.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/1ayWsLMPHSSc7g93m8703A/ab1056626d07120f78c7112e48efe5ba/r6-maps-favela-blueprint-3.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/5oUUSy3o0uPVZn2DOONzc7/8a5aa51fbd6e87a2a850c110ce3aee67/r6-maps-favela-blueprint-4.jpg'
		];
	} else if (selectedOption === 'Fortress') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/6Hb48Dou0oV4KBEU0yeXQz/bcfc52b3a4f32940d58d25837573bb38/r6-maps-fortress-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/5JzPtRP2tfM0bg7zt5zO5a/05406d9047812f1859deead10edc4a60/r6-maps-fortress-blueprint-2.jpg'
		];
	} else if (selectedOption === 'HerefordBase') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/2gVZDx0OOit8E6f1OnTJ4B/37e1b8ce2dc69e5b437b56d82f62cf40/r6-maps-hereford-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/qSEd5QKHT4EayRNx01EIH/42ffbe37e0dfc9074aed2e1e56eabb4c/r6-maps-hereford-blueprint-2.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/4rSxlBeEzZeGuuFFN1DilX/d5d56912aa426006e7ca70e7376f9292/r6-maps-hereford-blueprint-3.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/4q3OqSBy1Dx226IhrOwc7C/9db8a80e8b7ecadfa0c0627ef6f1477c/r6-maps-hereford-blueprint-4.jpg'
		];
	} else if (selectedOption === 'House') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/5CIH5XwkMXY6xuacmJEOK7/3608c604e4e1b6e819005ffdc409121b/r6-maps-house-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/1SdjkrdMoeWcDUjjbpFhF1/c3954b71dbaefa4129aac2e0fd5e5bfe/r6-maps-house-blueprint-2.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/6ZWHlGOaXqCBiahA0tspF8/d3133aee515e4c16b6660828b17f4861/r6-maps-house-blueprint-3.jpg'
		];
	} else if (selectedOption === 'KafeDostoyevsky') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/3WeSCQnTruB4nJ0n9xm7U7/cec112a997dd78b46515b6242d25a379/r6-maps-kafe-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/7njwDjC8jAG7g2krGRKsYb/2c4216a5f3baee22074759ba1dd45e55/r6-maps-kafe-blueprint-2.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/15f2nyYsxok1GMsuFCrOTW/9036cb95e0f3e048b93aed8f4c13483a/r6-maps-kafe-blueprint-3.jpg'
		];
	} else if (selectedOption === 'Kanal') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/fgm0tsyQwkBpzZflik2vS/3fee4162d712b61b5d3b65c3925153f3/r6-maps-kanal-blueprint-2.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/75B6AY7oIV1rshuQ3cZqUB/2f544df93573cd1871c8ff2a23c399d2/r6-maps-kanal-blueprint-3.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/XVYbcmygF5gMVpjohY4e9/ff2eea5e48ee48d193fff62373421652/r6-maps-kanal-blueprint-4.jpg'
		];
	} else if (selectedOption === 'Lair') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/5PYxexbImMQq45PlPjD9gu/4cd09b41784af37b09d0da70195a0b7e/r6-maps-lair-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/5daqcyybjo4fCebDDttTI5/9d3ffa11a695138640706f310f990553/r6-maps-lair-blueprint-2.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/144IZSQuvlTd5mbM9C1xHE/5df60b08430044972cd2add486e01018/r6-maps-lair-blueprint-3.jpg'
		];
	} else if (selectedOption === 'NighthavenLabs') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/79cZrFmYWuCtDCJwtLKvFn/a8ed21b415840882f77761360ce53b96/r6-maps-nighthavenlabs-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/66qd9bxgAePlWPj9kgzGvg/d5676fc1d523c632d176afbac9d626ab/r6-maps-nighthavenlabs-blueprint-2.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/31Y9aEgTpzdsVKP24E79JV/239054f74eebb3123296056f4467144e/r6-maps-nighthavenlabs-blueprint-3.jpg'
		];
	}		
	else if (selectedOption === 'Oregon') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/qxSuuyTFOj9GcclwEl77K/49277f2343c81f14825415a3cb4e0f96/r6-maps-oregon-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/6KfdmrotDdUSi3shCZn6O4/2316ad1fb161254f7fb38b2e6c906e64/r6-maps-oregon-blueprint-2.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/K3su6xloMRGuZPQw0yIVD/000e6deabe35780e68d356690d4625a6/r6-maps-oregon-blueprint-3.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/3eC0jrji8bJSrukCV8Th4j/ea96c1108b4575eabc16361a67826c6b/r6-maps-oregon-blueprint-4.jpg'
		];
	} else if (selectedOption === 'Outback') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/66RRI7vfHhSPVbmx7oVxsm/14bc3f49e7406b4552be9e5fff824ae6/r6-maps-outback-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/7jjNcQmgbqhjtZDHNttLha/a16a1fb966da20b802d75630ecd2e7d3/r6-maps-outback-blueprint-2.jpg'
		];
	} else if (selectedOption === 'PresidentialPlane') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/20j7FImvC3h1EPmq0aEpts/cb593ba8c851f3efbe1ad8165cd81f26/r6-maps-plane-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/6JKpfo5nVlD9ezsSBaCr9X/652e72e3e60fe459ed97e3daf2eb98d9/r6-maps-plane-blueprint-2.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/8EnE7KBVagdr2ao1OyBI3/2820b85d11b4bfcc963b8e6625ac27a9/r6-maps-plane-blueprint-3.jpg'
		];
	} else if (selectedOption === 'Skyscraper') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/3c0AWlxZek6YUUNTaNfyO6/6b22cb6614a28bf9c13641b234cfd7ed/r6-maps-skyscraper-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/1l0EjB5o3s3HewE1VqmRlu/20fc25c788e0be7519a3cdba8ff5a433/r6-maps-skyscraper-blueprint-2.jpg'
		];
	} else if (selectedOption === 'StadiumAlpha') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/1qiqEuocqlUOOKefeLyeBF/9a8fa7e8dbac2ab060226e6bdd6034d6/StadiumA_modal-basement.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/13vTynIdmUCHvKiiKRoFSV/cbad213ffef2c3417937fff86b16d74b/StadiumA_modal-ground.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/6Wek7jOjfEyWU2fFWlCdW5/4a718c94586ba01a94884ace7e796c4c/StadiumA_modal-1stFloor.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/254cahO5UmvuG3xVaMrlC/69924fbcafa4e7165f8856e68adc75bd/StadiumA_modal-2ndFloor.jpg'
		];
	} else if (selectedOption === 'StadiumBravo') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/5kjM4V84OeJNBSBIDFVB27/b84480a0d113d06570b1b15ccfa168d4/StadiumB_modal-basement.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/6ls3inF7vZICbgetuVsknm/4353d50ea717ef60692455c81727f87a/StadiumB_modal-1sFloor.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/vbvp0CJygmP5E3nPzXlun/4b7c8220886f3d8bdd375aea9cb1b567/StadiumB_modal-2ndFloor.jpg'
		];
	} else if (selectedOption === 'ThemePark') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/17vQ6v4og4uKWZ0YzG2Ja5/c2e4733d954bdd95801235e53ff47d6c/r6-maps-themepark-blueprint-2.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/MgXhGys4DRlJ893gGsp2m/ce12985365be6bc1544e72202e704383/r6-maps-themepark-blueprint-3.jpg'
		];
	} else if (selectedOption === 'Tower') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/TejCB29nG2m5LvmVmuEh2/2c41972d997f60f9a49ee9b57cfe2535/r6-maps-tower-blueprint-2.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/1iVDH4ysZtTKRkLpVLjUoP/816b51f7c7246fc48a907378181046b9/r6-maps-tower-blueprint-3.jpg'
		];
	} else if (selectedOption === 'Villa') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/1CDFxayW2mJLAJy1I9KlvY/cc04fefb6181fea17cd7ae4a8e460f1b/r6-maps-villa-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/3J49jyCJZ6nhs8NaPDxolQ/8831f7742e9f3f1e3350fd4691465275/r6-maps-villa-blueprint-3.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/DgTowUc6zjVXVDa2pKLX1/a820faf2af99b971a19ab799115b28f1/r6-maps-villa-blueprint-4.jpg'
		];
	} else if (selectedOption === 'Yacht') {
		imageUrls = [
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/IhShaYBfZRTl6gUbifABA/47208fb89c1cfff490067fd4eceaaf9c/r6-maps-yacht-blueprint-1.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/7uBEtPmxUn6FIUevrSff6k/3e4f0601610f8b50eddbc70cf978d3d5/r6-maps-yacht-blueprint-2.jpg',
			'https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/4fc6ERcX7GO9VFnadR7qtC/5dfddd14005ae50994d6cc0663da4a8c/r6-maps-yacht-blueprint-3.jpg'
		];
	}

    // Broadcast the image change to the server
    socket.send(JSON.stringify({ type: 'imageChange', imageUrls }));

    // Load images and create canvas elements
    imageUrls.forEach((url, index) => {
        const tab = document.createElement('div');
        tab.classList.add('tab');
        tab.textContent = `Floor ${index + 1}`;
        tab.dataset.index = index;
        tab.addEventListener('click', () => switchTab(index));
        tab.classList.add('btn');
        tabsContainer.appendChild(tab);

        const tabContent = document.createElement('div');
        tabContent.classList.add('tab-content');

        const canvas = document.createElement('canvas');
        tabContent.appendChild(canvas);

		const originalImage = document.createElement('img');
		originalImage.src = url;
		originalImage.style.display = 'none';
		
		tabContent.appendChild(originalImage);

        const image = new Image();
		image.crossOrigin = "anonymous";
        image.src = url;
        image.onload = () => {
            canvas.width = image.width;
            canvas.height = image.height;

            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0);

            // Attach drawing events to new canvas
            attachDrawingEvents(canvas);
        };

        tabContentContainer.appendChild(tabContent);
    });

    switchTab(0); // Automatically switch to the first tab
});

// Switch active tab
function switchTab(index, fromServer = false) {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    if (tabs.length === 0 || tabContents.length === 0) {
        console.error('Tabs or tabContents not found. Aborting tab switch.');
        return;
    }

    tabs.forEach(tab => tab.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
		
	console.log(index);
	
    tabs[index].classList.add('active');
    tabContents[index].classList.add('active');

    // Update current canvas and context
    currentCanvas = tabContents[index].querySelector('canvas');
    context = currentCanvas.getContext('2d');
    context.strokeStyle = strokeColor;

    // Only send the WebSocket message if the change was initiated locally
    if (!fromServer) {
        socket.send(JSON.stringify({ type: 'switchTabs', index: index }));
    }
}



// Attach drawing events to a canvas
function attachDrawingEvents(canvas) {
    let startX, startY;
    let isDrawing = false;  // Track whether the mouse is pressed down

    const draw = (e) => {
        if (!isDrawing) return;  // Only draw if mouse is pressed

        const x = e.clientX - canvas.offsetLeft;
        const y = e.clientY - canvas.offsetTop;

        context.lineWidth = lineWidth;
        context.lineCap = 'round';

        context.lineTo(x, y);
        context.stroke();

	if (event.type == 'mouseup') {
		
	}
        // Send drawing data to server
        socket.send(JSON.stringify({ type: 'draw', x, y, lineWidth, color: context.strokeStyle }));
    };

    canvas.addEventListener('mousedown', (e) => {
        startX = e.clientX - canvas.offsetLeft;
        startY = e.clientY - canvas.offsetTop;

        isDrawing = true; // Start drawing when mouse is pressed
        // Notify others to begin a new stroke
        socket.send(JSON.stringify({ type: 'beginStroke' }));

        context.beginPath(); // Reset path for the local client
        context.moveTo(startX, startY); // Move to starting point to prevent jump
    });

    canvas.addEventListener('mouseup', () => {
        isDrawing = false; // Stop drawing when mouse is released
        context.stroke();
        context.beginPath();
    });

    canvas.addEventListener('mousemove', draw);
}
