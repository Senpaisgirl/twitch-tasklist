import './App.css';
import TaskList from './components/tasklist/TaskList';

function App() {
  return (
    <div style={{
      background: "transparent",
      display: "flex",
      justifyContent: "flex-end", // Align to the right
      padding: "10px",
    }}>
      <TaskList />
    </div>
  );
}

export default App;
