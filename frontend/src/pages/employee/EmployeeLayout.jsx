import { Container, Nav, Navbar } from 'react-bootstrap'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

const EmployeeLayout = () => {
  const { profile, signOutUser } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="app-shell">
      <Navbar bg="white" expand="md" className="shadow-sm">
        <Container>
          <Navbar.Brand className="fw-bold">勤怠管理</Navbar.Brand>
          <Navbar.Toggle aria-controls="employee-nav" />
          <Navbar.Collapse id="employee-nav">
            <Nav className="me-auto">
              <Nav.Link as={NavLink} to="." end>
                今日の勤怠
              </Nav.Link>
              <Nav.Link as={NavLink} to="summary">
                月次サマリー
              </Nav.Link>
              <Nav.Link as={NavLink} to="history">
                勤務履歴
              </Nav.Link>
            </Nav>
            <div className="d-flex flex-column flex-md-row align-items-md-center gap-2 text-md-end">
              {profile?.role === 'admin' && (
                <button
                  className="btn btn-outline-primary btn-sm"
                  type="button"
                  onClick={() => navigate('/admin')}
                >
                  管理者画面
                </button>
              )}
              <span className="text-muted small">
                {profile?.department ? `${profile.department} ` : ''}
                {profile?.name ?? '社員'}
              </span>
              <button className="btn btn-outline-secondary btn-sm" type="button" onClick={signOutUser}>
                ログアウト
              </button>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <main className="app-content">
        <Container className="py-4">
          <Outlet />
        </Container>
      </main>
    </div>
  )
}

export default EmployeeLayout
