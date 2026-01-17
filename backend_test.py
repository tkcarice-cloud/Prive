import requests
import sys
import json
from datetime import datetime

class PriveAPITester:
    def __init__(self, base_url="https://elite-privacy.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tokens = {}
        self.user_ids = {}
        self.creator_ids = {}
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, auth_user=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if auth_user and auth_user in self.tokens:
            test_headers['Authorization'] = f'Bearer {self.tokens[auth_user]}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    'test': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'endpoint': endpoint
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                'test': name,
                'error': str(e),
                'endpoint': endpoint
            })
            return False, {}

    def test_health_check(self):
        """Test API health endpoints"""
        print("\n" + "="*50)
        print("TESTING API HEALTH")
        print("="*50)
        
        success1, _ = self.run_test("API Root", "GET", "", 200)
        success2, _ = self.run_test("Health Check", "GET", "health", 200)
        
        return success1 and success2

    def test_authentication(self):
        """Test user registration and login"""
        print("\n" + "="*50)
        print("TESTING AUTHENTICATION")
        print("="*50)
        
        timestamp = datetime.now().strftime('%H%M%S')
        
        # Test user registration
        test_users = [
            {
                'email': f'test_user_{timestamp}@prive.com',
                'username': f'testuser{timestamp}',
                'password': 'password123',
                'role': 'user'
            },
            {
                'email': f'test_creator_{timestamp}@prive.com', 
                'username': f'testcreator{timestamp}',
                'password': 'creator123',
                'role': 'creator'
            },
            {
                'email': f'test_admin_{timestamp}@prive.com',
                'username': f'testadmin{timestamp}',
                'password': 'admin123',
                'role': 'admin'
            }
        ]
        
        all_success = True
        
        for user_data in test_users:
            # Register user
            success, response = self.run_test(
                f"Register {user_data['role']}",
                "POST",
                "auth/register",
                200,
                data=user_data
            )
            
            if success and 'access_token' in response:
                self.tokens[user_data['role']] = response['access_token']
                self.user_ids[user_data['role']] = response['user']['id']
                print(f"   ✅ {user_data['role']} registered and token stored")
                
                # Test login
                login_success, login_response = self.run_test(
                    f"Login {user_data['role']}",
                    "POST", 
                    "auth/login",
                    200,
                    data={
                        'email': user_data['email'],
                        'password': user_data['password']
                    }
                )
                
                if not login_success:
                    all_success = False
                    
                # Test get current user
                me_success, _ = self.run_test(
                    f"Get current user ({user_data['role']})",
                    "GET",
                    "auth/me",
                    200,
                    auth_user=user_data['role']
                )
                
                if not me_success:
                    all_success = False
                    
            else:
                all_success = False
        
        return all_success

    def test_verification_system(self):
        """Test identity verification system"""
        print("\n" + "="*50)
        print("TESTING VERIFICATION SYSTEM")
        print("="*50)
        
        if 'user' not in self.tokens:
            print("❌ No user token available for verification tests")
            return False
            
        all_success = True
        
        # Test verification status check
        success1, _ = self.run_test(
            "Check verification status",
            "GET",
            "verification/status", 
            200,
            auth_user='user'
        )
        
        # Test verification submission
        verification_data = {
            'id_type': 'government_id',
            'id_front_url': 'https://example.com/id_front.jpg',
            'id_back_url': 'https://example.com/id_back.jpg',
            'selfie_url': 'https://example.com/selfie.jpg'
        }
        
        success2, response = self.run_test(
            "Submit verification",
            "POST",
            "verification/submit",
            200,
            data=verification_data,
            auth_user='user'
        )
        
        if success2:
            verification_id = response.get('id')
            print(f"   ✅ Verification submitted with ID: {verification_id}")
            
            # Test admin verification approval (if admin token available)
            if 'admin' in self.tokens and verification_id:
                success3, _ = self.run_test(
                    "Admin approve verification",
                    "POST",
                    f"admin/verifications/{verification_id}/approve",
                    200,
                    auth_user='admin'
                )
                all_success = all_success and success3
        
        return all_success and success1 and success2

    def test_creator_system(self):
        """Test creator profiles and content"""
        print("\n" + "="*50)
        print("TESTING CREATOR SYSTEM")
        print("="*50)
        
        if 'creator' not in self.tokens:
            print("❌ No creator token available for creator tests")
            return False
            
        all_success = True
        
        # Test list creators
        success1, creators = self.run_test(
            "List creators",
            "GET",
            "creators",
            200
        )
        
        if success1 and creators:
            creator_id = creators[0]['id'] if creators else None
            self.creator_ids['test'] = creator_id
            
            if creator_id:
                # Test get specific creator
                success2, _ = self.run_test(
                    "Get creator profile",
                    "GET",
                    f"creators/{creator_id}",
                    200
                )
                all_success = all_success and success2
        
        # Test update creator profile
        profile_data = {
            'display_name': 'Test Creator Updated',
            'bio': 'Updated bio for testing',
            'subscription_price': 19.99
        }
        
        success3, _ = self.run_test(
            "Update creator profile",
            "PUT",
            "creators/profile",
            200,
            data=profile_data,
            auth_user='creator'
        )
        
        # Test create content
        content_data = {
            'title': 'Test Content Post',
            'description': 'This is a test content post',
            'content_type': 'subscription',
            'media_urls': ['https://example.com/test_image.jpg']
        }
        
        success4, _ = self.run_test(
            "Create content",
            "POST",
            "content",
            200,
            data=content_data,
            auth_user='creator'
        )
        
        return all_success and success1 and success3 and success4

    def test_discover_system(self):
        """Test creator discovery"""
        print("\n" + "="*50)
        print("TESTING DISCOVER SYSTEM")
        print("="*50)
        
        all_success = True
        
        # Test discover creators
        success1, _ = self.run_test(
            "Discover creators",
            "GET",
            "discover",
            200
        )
        
        # Test discover with tier filter
        success2, _ = self.run_test(
            "Discover creators (verified tier)",
            "GET",
            "discover?tier=verified",
            200
        )
        
        # Test discover with search
        success3, _ = self.run_test(
            "Discover creators (search)",
            "GET",
            "discover?search=test",
            200
        )
        
        return all_success and success1 and success2 and success3

    def test_messaging_system(self):
        """Test E2EE messaging system"""
        print("\n" + "="*50)
        print("TESTING MESSAGING SYSTEM")
        print("="*50)
        
        if 'user' not in self.tokens or 'creator' not in self.tokens:
            print("❌ Need both user and creator tokens for messaging tests")
            return False
            
        all_success = True
        
        # Test get conversations
        success1, _ = self.run_test(
            "Get conversations",
            "GET",
            "messages/conversations",
            200,
            auth_user='user'
        )
        
        # Test send message (requires verification, might fail)
        message_data = {
            'recipient_id': self.user_ids.get('creator', 'test_id'),
            'content': 'Test encrypted message',
            'is_paid': False
        }
        
        success2, response = self.run_test(
            "Send message",
            "POST",
            "messages",
            200,
            data=message_data,
            auth_user='user'
        )
        
        # Note: This might fail due to verification requirement
        if not success2:
            print("   ℹ️  Message sending failed (likely due to verification requirement)")
        
        return all_success and success1

    def test_payment_system(self):
        """Test Stripe payment integration"""
        print("\n" + "="*50)
        print("TESTING PAYMENT SYSTEM")
        print("="*50)
        
        if 'user' not in self.tokens:
            print("❌ No user token available for payment tests")
            return False
            
        all_success = True
        
        # Test create checkout session
        checkout_data = {
            'payment_type': 'tip',
            'creator_id': self.creator_ids.get('test', 'test_creator_id'),
            'amount': 10.00,
            'origin_url': 'https://elite-privacy.preview.emergentagent.com'
        }
        
        success1, response = self.run_test(
            "Create checkout session",
            "POST",
            "payments/checkout",
            200,
            data=checkout_data,
            auth_user='user'
        )
        
        # Note: This might fail due to verification requirement
        if not success1:
            print("   ℹ️  Checkout creation failed (likely due to verification requirement)")
        
        return success1

    def test_admin_system(self):
        """Test admin panel functionality"""
        print("\n" + "="*50)
        print("TESTING ADMIN SYSTEM")
        print("="*50)
        
        if 'admin' not in self.tokens:
            print("❌ No admin token available for admin tests")
            return False
            
        all_success = True
        
        # Test get analytics
        success1, _ = self.run_test(
            "Get admin analytics",
            "GET",
            "admin/analytics",
            200,
            auth_user='admin'
        )
        
        # Test list verifications
        success2, _ = self.run_test(
            "List pending verifications",
            "GET",
            "admin/verifications?status=pending",
            200,
            auth_user='admin'
        )
        
        return all_success and success1 and success2

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting PRIVÉ API Testing")
        print(f"Base URL: {self.base_url}")
        
        # Run test suites in order
        health_ok = self.test_health_check()
        auth_ok = self.test_authentication()
        verify_ok = self.test_verification_system()
        creator_ok = self.test_creator_system()
        discover_ok = self.test_discover_system()
        messaging_ok = self.test_messaging_system()
        payment_ok = self.test_payment_system()
        admin_ok = self.test_admin_system()
        
        # Print final results
        print("\n" + "="*60)
        print("FINAL TEST RESULTS")
        print("="*60)
        print(f"Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed tests ({len(self.failed_tests)}):")
            for test in self.failed_tests:
                error_msg = test.get('error', f"Expected {test.get('expected')}, got {test.get('actual')}")
                print(f"   - {test['test']}: {error_msg}")
        
        print(f"\n📊 Test Suite Results:")
        print(f"   Health Check: {'✅' if health_ok else '❌'}")
        print(f"   Authentication: {'✅' if auth_ok else '❌'}")
        print(f"   Verification: {'✅' if verify_ok else '❌'}")
        print(f"   Creator System: {'✅' if creator_ok else '❌'}")
        print(f"   Discover System: {'✅' if discover_ok else '❌'}")
        print(f"   Messaging: {'✅' if messaging_ok else '❌'}")
        print(f"   Payments: {'✅' if payment_ok else '❌'}")
        print(f"   Admin Panel: {'✅' if admin_ok else '❌'}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = PriveAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())