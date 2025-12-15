// Global state
let currentUser = null;
let currentToken = null;
let currentElections = [];
let selectedElection = null;
let selectedCandidate = null;

const API_BASE = '';

// Show/hide tabs
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');
}

function showAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.admin-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`admin-${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');
    
    if (tabName === 'elections') {
        loadAdminElections();
    } else if (tabName === 'surveys') {
        loadSurveys();
    } else if (tabName === 'predictions') {
        loadPredictions();
    }
}

// Login form
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const role = document.getElementById('login-role').value;
    const adminPin = document.getElementById('admin-pin').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, adminPin: role === 'admin' ? adminPin : null })
        });
        
        const data = await response.json();
        if (data.success) {
            currentUser = data.user;
            currentToken = data.token;
            if (data.user.role === 'admin') {
                showAdminDashboard();
            } else {
                showVoterDashboard();
            }
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

// Register form
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role: 'voter' })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('Registration successful! Please login.');
            showTab('login');
        } else {
            alert(data.error || 'Registration failed');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

// Admin PIN visibility
document.getElementById('login-role').addEventListener('change', (e) => {
    document.getElementById('admin-pin-group').style.display = 
        e.target.value === 'admin' ? 'block' : 'none';
});

// Show dashboards
function showVoterDashboard() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('voter-dashboard').style.display = 'block';
    document.getElementById('voter-name').textContent = currentUser.name;
    loadVoterElections();
}

function showAdminDashboard() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('voter-dashboard').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'block';
    loadAdminElections();
}

function logout() {
    if (currentToken) {
        fetch(`${API_BASE}/api/logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
    }
    currentUser = null;
    currentToken = null;
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('voter-dashboard').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'none';
}

// Load elections for voter
async function loadVoterElections() {
    try {
        const response = await fetch(`${API_BASE}/api/elections`);
        const data = await response.json();
        currentElections = data.elections || [];
        
        const container = document.getElementById('voter-elections');
        container.innerHTML = '';
        
        currentElections.forEach(election => {
            if (election.phase === 'VOTING_OPEN') {
                const card = document.createElement('div');
                card.className = 'election-card';
                card.innerHTML = `
                    <h4>${election.title}</h4>
                    <span class="phase ${election.phase}">${election.phase}</span>
                    <p>${election.description || ''}</p>
                    <button class="btn btn-primary" onclick="openVoteModal(${election.id})">Vote Now</button>
                `;
                container.appendChild(card);
            }
        });
        
        // Load surveys
        loadVoterSurveys();
    } catch (error) {
        console.error('Error loading elections:', error);
    }
}

// Load surveys for voter
async function loadVoterSurveys() {
    try {
        const container = document.getElementById('voter-surveys');
        container.innerHTML = '<p>Loading surveys...</p>';
        
        const allSurveys = [];
        for (const election of currentElections) {
            const response = await fetch(`${API_BASE}/api/elections/${election.id}/surveys`);
            const data = await response.json();
            if (data.surveys) {
                allSurveys.push(...data.surveys.map(s => ({ ...s, electionTitle: election.title })));
            }
        }
        
        container.innerHTML = '';
        if (allSurveys.length === 0) {
            container.innerHTML = '<p class="info-text">No surveys available at the moment.</p>';
            return;
        }
        
        allSurveys.forEach(survey => {
            const card = document.createElement('div');
            card.className = 'election-card';
            card.innerHTML = `
                <h4>${survey.electionTitle}</h4>
                <p><strong>Candidate:</strong> ${survey.candidateName}</p>
                <p><strong>Question:</strong> ${survey.question}</p>
                <p><strong>Average Rating:</strong> ${survey.averageRating} / 5.0 (${survey.totalResponses} responses)</p>
                <button class="btn btn-primary" onclick="openSurveyModal(${survey.id})">Submit Response</button>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading surveys:', error);
    }
}

// Open vote modal
async function openVoteModal(electionId) {
    selectedElection = currentElections.find(e => e.id === electionId);
    if (!selectedElection) return;
    
    document.getElementById('vote-election-title').textContent = selectedElection.title;
    
    const candidatesDiv = document.getElementById('vote-candidates');
    candidatesDiv.innerHTML = '<h4>Select Candidate:</h4>';
    
    selectedElection.candidates.forEach((candidate, idx) => {
        const item = document.createElement('div');
        item.className = 'candidate-item';
        item.onclick = () => selectCandidate(idx, item);
        item.innerHTML = `
            <strong>${candidate}</strong>
            ${selectedElection.manifestos && selectedElection.manifestos[candidate] 
                ? `<div class="manifesto-box"><h5>Manifesto:</h5><p>${selectedElection.manifestos[candidate]}</p></div>` 
                : ''}
        `;
        candidatesDiv.appendChild(item);
    });
    
    document.getElementById('vote-modal').style.display = 'block';
}

function selectCandidate(index, element) {
    selectedCandidate = index;
    document.querySelectorAll('.candidate-item').forEach(item => {
        item.classList.remove('selected');
    });
    element.classList.add('selected');
}

function closeVoteModal() {
    document.getElementById('vote-modal').style.display = 'none';
    selectedCandidate = null;
}

async function submitVote() {
    if (selectedCandidate === null) {
        alert('Please select a candidate');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/votes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({
                electionId: selectedElection.id,
                choice: selectedCandidate
            })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('Vote cast successfully!');
            closeVoteModal();
            loadVoterElections();
        } else {
            alert(data.error || 'Failed to cast vote');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Admin functions
async function loadAdminElections() {
    try {
        const response = await fetch(`${API_BASE}/api/elections`);
        const data = await response.json();
        currentElections = data.elections || [];
        
        const container = document.getElementById('admin-elections');
        container.innerHTML = '';
        
        currentElections.forEach(election => {
            const card = document.createElement('div');
            card.className = 'election-card';
            const isCompleted = election.phase === 'TALLY_COMPLETE';
            card.innerHTML = `
                <h4>${election.title}</h4>
                <span class="phase ${election.phase}">${election.phase}</span>
                ${election.startTime ? `<p><small>Started: ${new Date(election.startTime).toLocaleDateString()}</small></p>` : ''}
                ${election.endTime ? `<p><small>Ended: ${new Date(election.endTime).toLocaleDateString()}</small></p>` : ''}
                <p>${election.description || ''}</p>
                <p><strong>Candidates:</strong> ${election.candidates.join(', ')}</p>
                ${isCompleted ? '<p class="alert alert-info"><strong>Previous Year Election - Results Available</strong></p>' : ''}
                <div style="margin-top: 15px;">
                    ${!isCompleted ? `
                        <button class="btn btn-primary" onclick="updatePhase(${election.id}, 'VOTING_OPEN')" 
                            ${election.phase === 'VOTING_OPEN' ? 'disabled' : ''}>Open Voting</button>
                        <button class="btn btn-secondary" onclick="updatePhase(${election.id}, 'VOTING_CLOSED')"
                            ${election.phase !== 'VOTING_OPEN' ? 'disabled' : ''}>Close Voting</button>
                        <button class="btn btn-primary" onclick="addManifesto(${election.id})">Add Manifesto</button>
                    ` : ''}
                    <button class="btn btn-primary" onclick="viewTally(${election.id})">View Results</button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading elections:', error);
    }
}

async function updatePhase(electionId, phase) {
    try {
        const response = await fetch(`${API_BASE}/api/elections/${electionId}/phase`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ phase })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('Election phase updated!');
            loadAdminElections();
        } else {
            alert(data.error || 'Failed to update phase');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function addManifesto(electionId) {
    selectedElection = currentElections.find(e => e.id === electionId);
    if (!selectedElection) return;
    
    const select = document.getElementById('manifesto-candidate');
    select.innerHTML = '';
    selectedElection.candidates.forEach(candidate => {
        const option = document.createElement('option');
        option.value = candidate;
        option.textContent = candidate;
        select.appendChild(option);
    });
    
    document.getElementById('manifesto-text').value = 
        selectedElection.manifestos[select.value] || '';
    
    document.getElementById('manifesto-modal').style.display = 'block';
}

function closeManifestoModal() {
    document.getElementById('manifesto-modal').style.display = 'none';
}

document.getElementById('manifesto-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const candidate = document.getElementById('manifesto-candidate').value;
    const manifesto = document.getElementById('manifesto-text').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/elections/${selectedElection.id}/manifesto`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ candidateName: candidate, manifesto })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('Manifesto saved!');
            closeManifestoModal();
            loadAdminElections();
        } else {
            alert(data.error || 'Failed to save manifesto');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

async function viewTally(electionId) {
    try {
        const response = await fetch(`${API_BASE}/api/elections/${electionId}/tally`);
        const data = await response.json();
        
        if (data.error) {
            alert(data.error);
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h2>Tally Results: ${data.electionTitle}</h2>
                <div class="tally-results">
                    <p><strong>Total Votes:</strong> ${data.totalVotes}</p>
                    ${data.candidates.map((c, idx) => `
                        <div>
                            <strong>${c.name}</strong>: ${c.votes} votes (${c.percentage}%)
                            <div class="result-bar">
                                <div class="result-bar-fill" style="width: ${c.percentage}%">
                                    ${c.percentage}%
                                </div>
                            </div>
                        </div>
                    `).join('')}
                    <h4>Winner: ${data.winner.name} with ${data.winner.votes} votes</h4>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Create election
document.getElementById('create-election-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('election-title').value;
    const description = document.getElementById('election-description').value;
    const candidates = document.getElementById('election-candidates').value.split(',').map(s => s.trim());
    
    try {
        const response = await fetch(`${API_BASE}/api/elections`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ title, description, candidates })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('Election created!');
            document.getElementById('create-election-form').reset();
            loadAdminElections();
        } else {
            alert(data.error || 'Failed to create election');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

// Load predictions
async function loadPredictions() {
    const container = document.getElementById('predictions-list');
    container.innerHTML = '<p>Loading predictions...</p>';
    
    try {
        const response = await fetch(`${API_BASE}/api/elections`);
        const data = await response.json();
        const elections = data.elections || [];
        
        container.innerHTML = '';
        
        for (const election of elections) {
            if (election.phase === 'VOTING_OPEN' || election.phase === 'VOTING_CLOSED') {
                const predResponse = await fetch(`${API_BASE}/api/elections/${election.id}/prediction`);
                const predData = await predResponse.json();
                
                if (!predData.error) {
                    const card = document.createElement('div');
                    card.className = 'prediction-card';
                    card.innerHTML = `
                        <h4>${predData.electionTitle}</h4>
                        <p><strong>Confidence:</strong> ${predData.confidence}%</p>
                        <p><strong>Data Source:</strong> ${predData.dataSource || 'Real Election Data'}</p>
                        <p><strong>Predicted Winner:</strong> ${predData.winner.candidate} (${predData.winner.winProbability}% chance)</p>
                        <div>
                            ${predData.predictions.map(p => `
                                <div class="prediction-item">
                                    <strong>${p.candidate}</strong>
                                    <div class="probability">${p.winProbability}% Win Probability</div>
                                    <p><strong>Current Performance:</strong> ${p.currentVotes} votes (${p.currentPercentage}%)</p>
                                    ${p.surveyRating !== 'N/A' ? `<p><strong>Survey Rating:</strong> ${p.surveyRating}/5.0 (${p.surveyResponses} responses)</p>` : ''}
                                    ${p.historicalWinRate !== 'N/A' ? `<p><strong>Historical Win Rate:</strong> ${p.historicalWinRate}%</p>` : ''}
                                    ${p.historicalAvgVoteShare !== 'N/A' ? `<p><strong>Historical Avg Vote Share:</strong> ${p.historicalAvgVoteShare}%</p>` : ''}
                                    <p><strong>Trend:</strong> ${p.trend}</p>
                                    ${p.popularity !== 'N/A' ? `<p><strong>Popularity Score:</strong> ${p.popularity}%</p>` : ''}
                                </div>
                            `).join('')}
                        </div>
                        <div style="margin-top: 15px;">
                            <strong>Analysis:</strong>
                            <ul>
                                ${predData.analysis.map(a => `<li>${a}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                    container.appendChild(card);
                }
            }
        }
    } catch (error) {
        container.innerHTML = '<p class="alert alert-error">Error loading predictions</p>';
    }
}

// Survey functions
let selectedSurvey = null;

async function openSurveyModal(surveyId) {
    try {
        const response = await fetch(`${API_BASE}/api/surveys`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await response.json();
        
        if (!data.surveys || !Array.isArray(data.surveys)) {
            alert('Failed to load surveys');
            return;
        }
        
        const survey = data.surveys.find(s => s.id === surveyId);
        
        if (!survey) {
            alert('Survey not found');
            return;
        }
        
        // Get election title from currentElections (ensure it's loaded)
        let electionTitle = `Election #${survey.electionId}`;
        if (currentElections && Array.isArray(currentElections)) {
            const election = currentElections.find(e => e.id === survey.electionId);
            if (election) {
                electionTitle = election.title;
            }
        } else {
            // If currentElections not loaded, fetch election details
            try {
                const electionResponse = await fetch(`${API_BASE}/api/elections/${survey.electionId}`);
                const electionData = await electionResponse.json();
                if (electionData.election) {
                    electionTitle = electionData.election.title;
                }
            } catch (err) {
                console.error('Error fetching election:', err);
            }
        }
        
        selectedSurvey = survey;
        document.getElementById('survey-content').innerHTML = `
            <h3>${electionTitle}</h3>
            <p><strong>Candidate:</strong> ${survey.candidateName}</p>
            <p><strong>Question:</strong> ${survey.question}</p>
        `;
        document.getElementById('survey-response-form').reset();
        document.getElementById('survey-modal').style.display = 'block';
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function closeSurveyModal() {
    document.getElementById('survey-modal').style.display = 'none';
    selectedSurvey = null;
}

document.getElementById('survey-response-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedSurvey) return;
    
    const rating = parseInt(document.getElementById('survey-rating').value);
    const comment = document.getElementById('survey-comment').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/surveys/${selectedSurvey.id}/response`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ rating, comment })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('Survey response submitted!');
            closeSurveyModal();
            loadVoterSurveys();
        } else {
            alert(data.error || 'Failed to submit response');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

// Admin survey functions
async function loadSurveys() {
    try {
        const response = await fetch(`${API_BASE}/api/surveys`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const data = await response.json();
        const surveys = data.surveys || [];
        
        const container = document.getElementById('surveys-list');
        container.innerHTML = '';
        
        if (surveys.length === 0) {
            container.innerHTML = '<p class="info-text">No surveys created yet.</p>';
            return;
        }
        
        surveys.forEach(survey => {
            const card = document.createElement('div');
            card.className = 'election-card';
            const ratingDist = survey.responses.reduce((acc, r) => {
                acc[r.rating] = (acc[r.rating] || 0) + 1;
                return acc;
            }, {});
            
            card.innerHTML = `
                <h4>Survey #${survey.id}</h4>
                <p><strong>Election:</strong> ${survey.electionId}</p>
                <p><strong>Candidate:</strong> ${survey.candidateName}</p>
                <p><strong>Question:</strong> ${survey.question}</p>
                <p><strong>Average Rating:</strong> ${survey.averageRating} / 5.0</p>
                <p><strong>Total Responses:</strong> ${survey.totalResponses}</p>
                <div style="margin-top: 10px;">
                    <strong>Rating Distribution:</strong>
                    ${[5,4,3,2,1].map(r => `<span style="margin-right: 10px;">${r}★: ${ratingDist[r] || 0}</span>`).join('')}
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading surveys:', error);
    }
}

function showCreateSurveyModal() {
    const electionSelect = document.getElementById('survey-election');
    const candidateSelect = document.getElementById('survey-candidate');
    
    electionSelect.innerHTML = '<option value="">Select election</option>';
    currentElections.forEach(election => {
        const option = document.createElement('option');
        option.value = election.id;
        option.textContent = election.title;
        electionSelect.appendChild(option);
    });
    
    electionSelect.addEventListener('change', (e) => {
        const electionId = parseInt(e.target.value);
        const election = currentElections.find(e => e.id === electionId);
        candidateSelect.innerHTML = '<option value="">Select candidate</option>';
        if (election) {
            election.candidates.forEach(candidate => {
                const option = document.createElement('option');
                option.value = candidate;
                option.textContent = candidate;
                candidateSelect.appendChild(option);
            });
        }
    });
    
    document.getElementById('create-survey-modal').style.display = 'block';
}

function closeCreateSurveyModal() {
    document.getElementById('create-survey-modal').style.display = 'none';
    document.getElementById('create-survey-form').reset();
}

document.getElementById('create-survey-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const electionId = parseInt(document.getElementById('survey-election').value);
    const candidateName = document.getElementById('survey-candidate').value;
    const question = document.getElementById('survey-question').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/surveys`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ electionId, candidateName, question })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('Survey created!');
            closeCreateSurveyModal();
            loadSurveys();
        } else {
            alert(data.error || 'Failed to create survey');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

