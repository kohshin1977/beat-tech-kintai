import { Container, Nav, Navbar } from 'react-bootstrap'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

const AdminLayout = () => {
  const { profile, signOutUser } = useAuth()

  return (
    <div className="app-shell">
      <Navbar bg="dark" data-bs-theme="dark" expand="lg" className="shadow-sm">
        <Container>
          <Navbar.Brand className="fw-bold">勤怠管理（管理者）</Navbar.Brand>
          <Navbar.Toggle aria-controls="admin-nav" />
          <Navbar.Collapse id="admin-nav">
            <Nav className="me-auto">
              <Nav.Link as={NavLink} to="." end>
                ダッシュボード
              </Nav.Link>
              <Nav.Link as={NavLink} to="daily">
                日次勤怠
              </Nav.Link>
              <Nav.Link as={NavLink} to="export">
                エクスポート
              </Nav.Link>
            </Nav>
            <div className="d-flex flex-column flex-lg-row align-items-lg-center gap-2 text-lg-end">
              <span className="text-muted small">
                {profile?.department ? `${profile.department} ` : ''}
                {profile?.name ?? '管理者'}
              </span>
              <button type="button" className="btn btn-outline-light btn-sm" onClick={signOutUser}>
                ログアウト
              </button>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <main className="app-content">
        <Container fluid className="py-4">
          <Outlet />
        </Container>
      </main>
    </div>
  )
}

export default AdminLayout
